import React, { useEffect } from 'react'
import { Background, BackgroundVariant, ReactFlow, MiniMap } from '@xyflow/react'

import CustomControls from '../controls/Controls'
import { NodePicker } from '../node-picker/NodePicker'
import { useFlowHandlers, useBehaveGraphFlow } from '../hooks'
import { Tab, usePubSub } from '@magickml/providers'

import { SpellInterfaceWithGraph } from '@magickml/agent-server-schemas'
import { getNodeSpec } from '@magickml/node-spec'
import { useSelector } from 'react-redux'
import { RootState, useSelectAgentsSpell } from 'client/state'
import { nodeColor } from '../utils/nodeColor'
import { ContextNodeMenu } from '../controls/context-node-menu'
import CustomEdge from '../node/custom-edge'
import { NodeSpecJSON } from '@magickml/behave-graph'

type FlowProps = {
spell: SpellInterfaceWithGraph
parentRef: React.RefObject<HTMLDivElement>
tab: Tab
readOnly?: boolean
windowDimensions: { width: number; height: number }
}

const edgeTypes = {
'custom-edge': CustomEdge,
}

const proOptions = {
// passing in the account property will enable hiding the attribution
// for versions < 10.2 you can use account: 'paid-enterprise'
account: 'paid-pro',
// in combination with the account property, hideAttribution: true will remove the attribution
hideAttribution: true,
}

function isEmptyObject(obj: object): boolean {
return Object.keys(obj).length === 0
}

export const OGFlow: React.FC<FlowProps> = ({
spell,
parentRef,
tab,
readOnly = false,
windowDimensions,
}) => {
const globalConfig = useSelector((state: RootState) => state.globalConfig)
const { lastItem: lastSpellEvent } = useSelectAgentsSpell()
const { projectId, currentAgentId } = globalConfig
const { publish, events } = usePubSub()

const [specJson, setSpecJson] = React.useState<NodeSpecJSON[]>([])
const [playing, setPlaying] = React.useState(false)
const [miniMapOpen, setMiniMapOpen] = React.useState(true)

const { SEND_COMMAND } = events

useEffect(() => {
if (!spell) return

    const specs = getNodeSpec(spell)
    setSpecJson(specs)

    // trigger initial sync
    publish(events.SEND_COMMAND, {
      agentId: currentAgentId,
      command: 'agent:spellbook:syncState',
      data: {
        spellId: spell.id,
      },
    })

}, [spell])

useEffect(() => {
if (!lastSpellEvent || lastSpellEvent.spellId !== spell.id) return
if (!lastSpellEvent.state) return

    // Process only spell state events here
    if (lastSpellEvent.state.isRunning) {
      setPlaying(true)
    } else if (!lastSpellEvent.state.isRunning) {
      setPlaying(false)
    }

}, [lastSpellEvent])

const {
nodes,
edges,
onNodesChange,
onEdgesChange,
setGraphJson,
nodeTypes,
} = useBehaveGraphFlow({
spell,
specJson,
tab,
})

const {
handleOnConnect,
handleStartConnect,
handleStopConnect,
handlePaneClick,
handlePaneContextMenu,
nodePickerPosition,
pickedNodeVisibility,
handleAddNode,
closeNodePicker,
nodePickFilters,
nodeMenuVisibility,
handleNodeContextMenu,
openNodeMenu,
setOpenNodeMenu,
nodeMenuActions,
isValidConnectionHandler,
onEdgeUpdate,
} = useFlowHandlers({
nodes,
edges,
onEdgesChange,
onNodesChange,
specJSON: specJson,
parentRef,
tab,
windowDimensions,
})

const togglePlay = () => {
if (playing) {
publish(SEND_COMMAND, {
projectId,
agentId: currentAgentId,
command: 'agent:spellbook:pauseSpell',
data: {
spellId: spell.id,
},
})
} else {
publish(SEND_COMMAND, {
projectId,
agentId: currentAgentId,
command: 'agent:spellbook:playSpell',
data: {
spellId: spell.id,
},
})
}
setPlaying(!playing)
}

if (!nodeTypes || isEmptyObject(nodeTypes)) return null

return (
<ReactFlow
proOptions={proOptions}
nodeTypes={nodeTypes}
nodes={nodes}
edges={edges}
onNodesChange={onNodesChange(tab.id)}
onEdgesChange={onEdgesChange(tab.id)}
nodesDraggable={!readOnly}
nodesConnectable={!readOnly}
elementsSelectable={!readOnly}
onConnect={handleOnConnect}
edgeTypes={edgeTypes}
isValidConnection={isValidConnectionHandler}
onEdgeUpdate={onEdgeUpdate}
onConnectStart={handleStartConnect}
onConnectEnd={handleStopConnect}
elevateEdgesOnSelect={true}
fitView
fitViewOptions={{ maxZoom: 2, minZoom: 0.1 }}
minZoom={0.1}
onPaneClick={handlePaneClick}
onPaneContextMenu={handlePaneContextMenu}
onNodeContextMenu={handleNodeContextMenu} >
<CustomControls
playing={playing}
togglePlay={togglePlay}
setBehaviorGraph={setGraphJson}
specJson={specJson}
miniMapOpen={miniMapOpen}
toggleMiniMap={() => setMiniMapOpen(!miniMapOpen)}
/>
<Background
variant={BackgroundVariant.Lines}
color="var(--background-color-light)"
style={{ backgroundColor: 'var(--background-color)' }}
/>
{miniMapOpen && (
<MiniMap
nodeStrokeWidth={3}
maskColor="#69696930"
nodeColor={node => nodeColor(node, specJson, spell)}
pannable
zoomable
/>
)}
{nodePickerPosition && !readOnly && (
<NodePicker
          position={nodePickerPosition}
          pickedNodePosition={pickedNodeVisibility}
          filters={nodePickFilters}
          onPickNode={handleAddNode}
          onClose={closeNodePicker}
          specJSON={specJson}
        />
)}

      {openNodeMenu && (
        <ContextNodeMenu
          position={nodeMenuVisibility}
          isOpen={openNodeMenu}
          onClose={() => setOpenNodeMenu(false)}
          actions={nodeMenuActions}
        />
      )}
    </ReactFlow>

)
}
