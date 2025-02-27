import {
  NodeCategory,
  SocketsList,
  makeFlowNodeDefinition,
} from '@magickml/behave-graph'
import { ArrayVariable } from './ArrayVariable'
import { IVariableService } from '../../services/variableService'

export const arrayPush = makeFlowNodeDefinition({
  typeName: 'logic/array/push',
  category: NodeCategory.Action,
  label: 'Array Push',
  configuration: {
    hiddenProperties: {
      valueType: 'array',
      defaultValue: [
        'hiddenProperties',
        'valueTypes',
        'socketInputs',
        'valueTypeOptions',
      ],
    },
    valueType: {
      valueType: 'string',
      defaultValue: '',
    },
    valueTypeOptions: {
      valueType: 'object',
      defaultValue: {
        values: ['string', 'number', 'float', 'boolean', 'object', 'array'],
        socketName: 'Item',
      },
    },
    socketInputs: {
      valueType: 'array',
      defaultValue: [],
    },
  },
  in: configuration => {
    const startSockets: SocketsList = [
      { key: 'array', valueType: 'array' },
      { key: 'flow', valueType: 'flow' },
    ]

    const socketArray =
      configuration?.socketInputs?.length > 0 ? configuration.socketInputs : []

    return [...startSockets, ...socketArray]
  },
  out: {
    flow: 'flow',
    array: 'array',
  },
  initialState: undefined,
  triggered: async ({
    commit,
    read,
    write,
    configuration,
    graph: { getDependency },
  }) => {
    const options = configuration?.valueTypeOptions
    const value = read(options.socketName)
    const array = read('array') as ArrayVariable<any>
    if (typeof value !== 'undefined') {
      array.push(value)
      // mutate the original array in memory if we are interacting with an array variable
      if (ArrayVariable.isInstance(array) && array.key) {
        const variableService =
          getDependency<IVariableService>('IVariableService')
        await variableService?.setByKey(array.key, array)
      }
    }

    write('array', array)
    commit('flow')
  },
})
