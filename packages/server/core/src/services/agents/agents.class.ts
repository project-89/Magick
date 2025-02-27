import { fetchAllPages } from '@magickml/utils'
// DOCUMENTED
// For more information about this file see https://dove.feathersjs.com/guides/cli/service.class.html#database-services
import type { Params } from '@feathersjs/feathers'
import { KnexAdapter } from '@feathersjs/knex'
import type { KnexAdapterParams, KnexAdapterOptions } from '@feathersjs/knex'
import { app } from '../../app'
import md5 from 'md5'
import type { Application } from '../../declarations'
import type { Agent, AgentData, AgentPatch, AgentQuery } from './agents.schema'
import { SpellData } from '../spells/spells.schema'
import { v4 as uuidv4 } from 'uuid'
import { BadRequest, NotAuthenticated, NotFound } from '@feathersjs/errors'

import { EventPayload, ISeraphEvent } from '@magickml/shared-services'
import { AgentCommandData } from '@magickml/agent-commander'
import { AgentInterface } from '@magickml/agent-server-schemas'

// Define AgentParams type based on KnexAdapterParams with AgentQuery
export type AgentParams = KnexAdapterParams<AgentQuery>

type MessagePayload = EventPayload & {
  agentId: string
}
/**
 * Default AgentService class.
 * Calls the standard Knex adapter service methods but can be customized with your own functionality.
 *
 * @template ServiceParams - The input params for the service
 * @extends KnexService
 */
export class AgentService<
  ServiceParams extends Params = AgentParams
> extends KnexAdapter<AgentInterface, AgentData, ServiceParams, AgentPatch> {
  app: Application

  constructor(options: KnexAdapterOptions, app: Application) {
    super(options)
    this.app = app
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async authorizeAgentPermissions(agentId: string, params?: ServiceParams) {
    if (!agentId) {
      console.error('agentId is required, Received null or undefined')
      throw new BadRequest('agentId is required')
    }
    const agent = await this._get(agentId, params)
    if (!agent) throw new NotFound('Agent not found')
    const projectId = agent.projectId
    if (params?.provider) {
      if (agent.projectId !== projectId) {
        console.error(
          'Agent does not belong to the project',
          projectId,
          agentId
        )
        throw new NotAuthenticated("You don't have access to this agent")
      }
    }
  }

  async message(data: MessagePayload, params?: ServiceParams) {
    const agentId = data.agentId

    this.authorizeAgentPermissions(agentId, params)

    const agentCommander = this.app.get('agentCommander')
    await agentCommander.message(agentId, data)

    return {
      data: {
        success: true,
      },
    }
  }

  async syncState(agentId: string, params?: ServiceParams) {
    this.authorizeAgentPermissions(agentId, params)

    const agentCommander = this.app.get('agentCommander')
    await agentCommander.syncState(agentId)

    return {
      data: {
        success: true,
      },
    }
  }

  // we use this ping to avoid firing a patched event on the agent
  // every time the agent is pinged
  async ping(agentId: string, params?: ServiceParams) {
    this.authorizeAgentPermissions(agentId, params)
    const agentCommander = this.app.get('agentCommander')
    await agentCommander.ping(agentId)

    return {
      data: {
        success: true,
      },
    }
  }

  async processSeraphEvent(seraphEvent: ISeraphEvent, params?: ServiceParams) {
    const agentId = seraphEvent.agentId

    this.authorizeAgentPermissions(agentId, params)

    const agentCommander = this.app.get('agentCommander')
    await agentCommander.processSeraphEvent(seraphEvent)

    return {
      data: {
        success: true,
      },
    }
  }

  async get(agentId: string, params?: ServiceParams) {
    return await this._get(agentId, params)
  }

  async find(params?: ServiceParams) {
    // Check if params and params.query exist before proceeding
    if (params?.query) {
      for (const key in params.query) {
        if (Object.prototype.hasOwnProperty.call(params.query, key)) {
          if (params.query[key] === 'null') {
            params.query[key] = null
          }
        }
      }

      // Check for 'paginate' parameter
      const paginate = params.query.paginate

      // Remove 'paginate' from query to avoid conflicts
      if (params.query.hasOwnProperty('paginate')) {
        delete params.query.paginate
      }

      // If 'paginate' parameter is set to 'false', bypass pagination
      if (paginate === 'false') {
        // Override default pagination settings
        const nonPaginatedParams = {
          ...params,
          paginate: false,
        }
        return await this._find(nonPaginatedParams)
      }
    }

    // Proceed with normal behavior (paginated find)
    return await this._find(params)
  }

  async update(id: string, data: AgentInterface, params?: ServiceParams) {
    return this._update(id, data, params)
  }

  /**p
   * Executes a command on the agent.
   * @param data - The data required to execute the command.
   * @returns An object containing the response from the agent.
   */
  async command(data: AgentCommandData, params?: ServiceParams) {
    if (!data.agentId) throw new BadRequest('agentId is required')
    // validate user owns the agent

    this.authorizeAgentPermissions(data.agentId, params)

    const agentCommander = this.app.get('agentCommander')
    const response = await agentCommander.command(data)

    return { response }
  }

  async subscribe(agentId: string, params?: ServiceParams) {
    // check for socket io
    if (!params?.provider)
      throw new Error('subscribe is only available via socket io')

    // check for agentId
    if (!agentId) throw new Error('agentId is required')

    this.authorizeAgentPermissions(agentId, params)

    // get the socket from the params
    const connection = params?.connection

    if (!connection) throw new Error('connection is required')

    if (app.get('environment') !== 'server') return

    const oldAgentChannel = app.channels.filter(channel =>
      channel.match(/agent:/)
    )[0]

    if (oldAgentChannel) {
      const oldAgentId = oldAgentChannel.split(':')[1]
      // leave the old channel
      app.channel(oldAgentChannel).leave(connection)

      // turn off the old agent
      this.command({
        agentId: oldAgentId,
        command: 'agent:spellbook:toggleLive',
        data: {
          live: false,
        },
      })
    }

    // join the new channel
    this.app.get('logger').debug(`Subscribing to agent ${agentId}`)
    app.channel(`agent:${agentId}`).join(connection)

    // turn on the new agent
    this.command({
      agentId,
      command: 'agent:spellbook:toggleLive',
      data: {
        live: true,
      },
    })

    return true
  }

  async getSeraphEvents(params?: ServiceParams): Promise<ISeraphEvent[]> {
    try {
      const agentId = params?.query?.agentId
      if (!agentId) throw new Error('agentId missing')
      const seraphEvents = await this.app
        .get('dbClient')
        .select('*')
        .from('seraphEvents')
        .where({ agentId })
        .orderBy('createdAt', 'asc')
        .limit(100)
      return seraphEvents
    } catch (error: any) {
      console.error('Error getting seraph events', error)
      throw new Error(`Error getting seraph events: ${error.message}`)
    }
  }

  async createSeraphEvent(data: ISeraphEvent): Promise<boolean> {
    try {
      if (!data) throw new Error('seraph event data missing')
      console.log('SERAPH STAGE 2:', data)

      const eventData = await this.app
        .get('dbClient')
        .insert(data)
        .into('seraphEvents')

      if (!eventData) throw new Error('Error creating seraph event')

      this.app.get('agentCommander').processSeraphEvent(data)

      return true
    } catch (error: any) {
      console.error('Error creating seraph event', error)
      throw new Error(`Error creating seraph event: ${error.message}`)
    }
  }

  async deleteSeraphEvent(data: any): Promise<boolean> {
    try {
      const { seraphEventId } = data
      if (!seraphEventId) {
        throw new Error('agentId missing')
      }

      const deletedEvents = await this.app
        .get('dbClient')
        .from('seraphEvents')
        .where({ id: seraphEventId })
        .del()

      if (!deletedEvents) {
        throw new Error('Error deleting seraph event')
      }

      return true
    } catch (error: any) {
      throw new Error(`Error deleting seraph event: ${error.message}`)
    }
  }

  async createRelease({
    agentId,
    description,
    agentToCopyId,
  }: {
    agentId: string
    description: string
    agentToCopyId: string
  }): Promise<{ spellReleaseId: string }> {
    // Start a new transaction
    return this.app
      .get('dbClient')
      .transaction(async trx => {
        const agentToUpdate = await trx('agents').where({ id: agentId }).first()
        const agentToCopy = await trx('agents')
          .where({ id: agentToCopyId })
          .first()

        if (!agentToUpdate || !agentToCopy) {
          throw new Error(`Agent with id ${agentId} not found`)
        }
        const projectId = agentToUpdate.projectId

        const [spellRelease] = await trx('spellReleases')
          .insert({
            id: uuidv4(),
            description: description || '',
            agentId: agentToUpdate.id,
            projectId,
          })
          .returning('*')

        // Fetch spells based on the source determined
        const allSpells: SpellData[] = await fetchAllPages(
          this.app.service('spells').find.bind(this.app.service('spells')),
          {
            query: {
              projectId,
              agentId: agentToCopy?.id,
            },
            transaction: trx,
          }
        )

        const draftSpellsToCopy: SpellData[] =
          allSpells.filter((spell: SpellData) => !spell.spellReleaseId) || []
        if (draftSpellsToCopy.length > 0) {
          const newSpells: SpellData[] = []
          if (draftSpellsToCopy.length > 0) {
            // Duplicate spells for the new release
            for (const spell of draftSpellsToCopy) {
              const newSpell = (await trx('spells')
                .insert({
                  ...spell,
                  id: uuidv4(),
                  spellReleaseId: spellRelease.id,
                  updatedAt: new Date().toISOString(),
                  createdAt: new Date().toISOString(),
                  type: spell.type ?? 'spell',
                })
                .returning('*')) as SpellData[]
              newSpells.push(newSpell[0])
            }
          }
        }

        // Update agent with new spell release ID
        await trx('agents').where({ id: agentToUpdate.id }).update({
          currentSpellReleaseId: spellRelease.id,
          updatedAt: new Date().toISOString(),
        })

        return {
          spellReleaseId: spellRelease.id,
          agentToUpdateId: agentToUpdate.id,
        }
      })
      .then(({ spellReleaseId, agentToUpdateId }) => {
        this.app.service('agents').patch(agentToUpdateId, {
          currentSpellReleaseId: spellReleaseId,
          updatedAt: new Date().toISOString(),
        })

        return { spellReleaseId }
      })
      .catch(err => {
        throw new Error(`Error creating release: ${err.message}`)
      })
  }

  async create(
    data: AgentData | AgentData[] | any
  ): Promise<Agent | Agent[] | any> {
    // ADDING REST API KEY TO AGENT's DATA

    if (data.data) {
      data.data = JSON.stringify({
        ...(typeof data.data === 'string' ? JSON.parse(data.data) : data.data),
        rest_api_key: md5(Math.random().toString()),
      })
    } else {
      data.data = JSON.stringify({
        rest_enabled: true,
        rest_api_key: md5(Math.random().toString()),
      })
    }
    return await this._create(data)
  }

  async patch(agentId: string, params: AgentPatch) {
    return this._patch(agentId, params)
  }

  async remove(agentId: string, params?: ServiceParams) {
    return this._remove(agentId, params)
  }
}

/**
 * Returns options needed to initialize the AgentService.
 *
 * @param app - the Feathers application
 * @returns KnexAdapterOptions - options for initializing the Knex adapter
 */
export const getOptions = (app: Application): KnexAdapterOptions => {
  return {
    paginate: app.get('paginate'),
    Model: app.get('dbClient'),
    name: 'agents',
    multi: ['remove'],
  }
}
