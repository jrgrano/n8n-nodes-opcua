import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeProperties,
	INodeType,
	INodeTypeDescription,
	JsonObject,
	JsonValue,
} from 'n8n-workflow';
import { NodeApiError, NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import {
	AttributeIds,
	BrowseDirection,
	DataType,
	OPCUAClient,
	UserTokenType,
	type ClientSession,
	type UserIdentityInfo,
} from 'node-opcua-client';

type OpcUaCredentials = {
	endpointUrl: string;
	securityMode: string;
	securityPolicy: string;
	authentication: 'anonymous' | 'usernamePassword';
	username?: string;
	password?: string;
	connectionTimeout: number;
};

type NodeEntry = { nodeId: string };
type WriteEntry = NodeEntry & { dataType: string; value: unknown };

const dataTypes: Record<string, DataType> = {
	boolean: DataType.Boolean,
	sbyte: DataType.SByte,
	byte: DataType.Byte,
	int16: DataType.Int16,
	uint16: DataType.UInt16,
	int32: DataType.Int32,
	uint32: DataType.UInt32,
	float: DataType.Float,
	double: DataType.Double,
	string: DataType.String,
	dateTime: DataType.DateTime,
};

const nodeCollection: INodeProperties = {
	displayName: 'Nodes',
	name: 'nodes',
	type: 'fixedCollection',
	typeOptions: { multipleValues: true },
	default: {},
	options: [
		{
			displayName: 'Node',
			name: 'node',
			values: [
				{
					displayName: 'Node ID',
					name: 'nodeId',
					type: 'string',
					required: true,
					default: '',
					placeholder: 'ns=2;s=Machine.Temperature',
					description: 'OPC UA Node ID, for example ns=2;s=Machine.Temperature or ns=3;i=1001',
				},
			],
		},
	],
};

const nodeIdProperty: INodeProperties = {
	displayName: 'Node ID',
	name: 'nodeId',
	type: 'string',
	required: true,
	default: '',
	placeholder: 'ns=2;s=Machine.Temperature',
	description: 'OPC UA Node ID, for example ns=2;s=Machine.Temperature or ns=3;i=1001',
};

export class OpcUa implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'OPC UA',
		name: 'opcUa',
		icon: { light: 'file:opcua.png', dark: 'file:opcua.dark.png' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Read and write data from an OPC UA server',
		defaults: { name: 'OPC UA' },
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		usableAsTool: true,
		credentials: [{ name: 'opcUaApi', required: true, testedBy: 'opcUaApiTest' }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Browse', value: 'browse', description: 'Browse references from a node', action: 'Browse OPC UA references' },
					{ name: 'Read', value: 'read', description: 'Read one or more node values', action: 'Read OPC UA values' },
					{ name: 'Write', value: 'write', description: 'Write one or more node values', action: 'Write OPC UA values' },
				],
				default: 'read',
			},
			{
				...nodeCollection,
				displayOptions: { show: { operation: ['read'] } },
			},
			{
				displayName: 'Nodes',
				name: 'nodesToWrite',
				type: 'fixedCollection',
				typeOptions: { multipleValues: true },
				default: {},
				displayOptions: { show: { operation: ['write'] } },
				options: [
					{
						displayName: 'Node',
						name: 'node',
						values: [
							nodeIdProperty,
							{
								displayName: 'Data Type',
								name: 'dataType',
								type: 'options',
								options: [
									{ name: 'Boolean', value: 'boolean' }, { name: 'Byte', value: 'byte' },
									{ name: 'Date and Time', value: 'dateTime' }, { name: 'Double', value: 'double' },
									{ name: 'Float', value: 'float' }, { name: 'Int16', value: 'int16' },
									{ name: 'Int32', value: 'int32' }, { name: 'SByte', value: 'sbyte' },
									{ name: 'String', value: 'string' }, { name: 'UInt16', value: 'uint16' },
									{ name: 'UInt32', value: 'uint32' },
								],
								default: 'string',
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								description: 'Value to write. Expressions preserve number and boolean values.',
							},
						],
					},
				],
			},
			{
				displayName: 'Node ID',
				name: 'browseNodeId',
				type: 'string',
				required: true,
				default: 'ObjectsFolder',
				placeholder: 'ns=2;s=Machine',
				displayOptions: { show: { operation: ['browse'] } },
			},
			{
				displayName: 'Direction',
				name: 'browseDirection',
				type: 'options',
				options: [
					{ name: 'Forward', value: 'forward' },
					{ name: 'Inverse', value: 'inverse' },
					{ name: 'Both', value: 'both' },
				],
				default: 'forward',
				displayOptions: { show: { operation: ['browse'] } },
			},
		],
	};

	methods = {
		credentialTest: {
			async opcUaApiTest(credential: { data?: unknown }) {
				const credentials = credential.data as unknown as OpcUaCredentials;
				let client: OPCUAClient | undefined;
				let session: ClientSession | undefined;
				try {
					client = OPCUAClient.create({
						endpointMustExist: false,
						securityMode: credentials.securityMode,
						securityPolicy: credentials.securityPolicy,
						defaultTransactionTimeout: credentials.connectionTimeout,
					});
					await client.connect(credentials.endpointUrl);
					session = await client.createSession(createIdentity(credentials));
					return { status: 'OK' as const, message: 'Successfully connected to the OPC UA server' };
				} catch (error) {
					return { status: 'Error' as const, message: (error as Error).message };
				} finally {
					if (session) await session.close().catch(() => undefined);
					if (client) await client.disconnect().catch(() => undefined);
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			let client: OPCUAClient | undefined;
			let session: ClientSession | undefined;

			try {
				const credentials = (await this.getCredentials('opcUaApi')) as unknown as OpcUaCredentials;
				const operation = this.getNodeParameter('operation', itemIndex) as string;
				client = OPCUAClient.create({
					connectionStrategy: { initialDelay: 1000, maxRetry: 0 },
					endpointMustExist: false,
					securityMode: credentials.securityMode,
					securityPolicy: credentials.securityPolicy,
					defaultTransactionTimeout: credentials.connectionTimeout,
				});
				await client.connect(credentials.endpointUrl);
				session = await client.createSession(getIdentity.call(this, credentials));

				let data: JsonObject;
				if (operation === 'read') {
					data = await readNodes(session, getNodes.call(this, itemIndex, 'nodes'));
				} else if (operation === 'write') {
					data = await writeNodes.call(this, session, getNodes.call(this, itemIndex, 'nodesToWrite') as WriteEntry[]);
				} else {
					data = await browseNode.call(this, session, itemIndex);
				}

				returnData.push({ json: data, pairedItem: { item: itemIndex } });
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: itemIndex } });
					continue;
				}
				throw new NodeApiError(this.getNode(), { message: (error as Error).message }, { itemIndex });
			} finally {
				if (session) await session.close().catch(() => undefined);
				if (client) await client.disconnect().catch(() => undefined);
			}
		}

		return [returnData];
	}

}

function getIdentity(this: IExecuteFunctions, credentials: OpcUaCredentials): UserIdentityInfo {
	if (credentials.authentication === 'usernamePassword') {
		if (!credentials.username || !credentials.password) {
			throw new NodeOperationError(this.getNode(), 'Username and password are required for this authentication method');
		}
		return { type: UserTokenType.UserName, userName: credentials.username, password: credentials.password };
	}
	return { type: UserTokenType.Anonymous };
}

function createIdentity(credentials: OpcUaCredentials): UserIdentityInfo {
	if (credentials.authentication === 'usernamePassword') {
		return { type: UserTokenType.UserName, userName: credentials.username ?? '', password: credentials.password ?? '' };
	}
	return { type: UserTokenType.Anonymous };
}

function getNodes(this: IExecuteFunctions, itemIndex: number, parameterName: string): NodeEntry[] {
	const collection = this.getNodeParameter(parameterName, itemIndex, {}) as { node?: NodeEntry[] };
	if (!collection.node?.length) throw new NodeOperationError(this.getNode(), 'Add at least one OPC UA node');
	return collection.node;
}

async function readNodes(session: ClientSession, nodes: NodeEntry[]): Promise<JsonObject> {
	const values = await session.read(nodes.map(({ nodeId }) => ({ nodeId, attributeId: AttributeIds.Value })));
	return {
		values: values.map((dataValue, index) => ({
			nodeId: nodes[index].nodeId,
			value: toJsonValue(dataValue.value.value),
			dataType: dataValue.value.dataType,
			statusCode: dataValue.statusCode.toString(),
			sourceTimestamp: dataValue.sourceTimestamp?.toISOString() ?? null,
			serverTimestamp: dataValue.serverTimestamp?.toISOString() ?? null,
		})),
	};
}

async function writeNodes(this: IExecuteFunctions, session: ClientSession, nodes: WriteEntry[]): Promise<JsonObject> {
	const statuses = await session.write(nodes.map(({ nodeId, dataType, value }) => ({
		nodeId,
		attributeId: AttributeIds.Value,
		value: { value: { dataType: dataTypes[dataType], value: coerceValue.call(this, dataType, value) } },
	})));
	return { values: statuses.map((statusCode, index) => ({ nodeId: nodes[index].nodeId, statusCode: statusCode.toString() })) };
}

async function browseNode(this: IExecuteFunctions, session: ClientSession, itemIndex: number): Promise<JsonObject> {
	const nodeId = this.getNodeParameter('browseNodeId', itemIndex) as string;
	const direction = this.getNodeParameter('browseDirection', itemIndex) as string;
	const browseDirection = { forward: BrowseDirection.Forward, inverse: BrowseDirection.Inverse, both: BrowseDirection.Both }[direction];
	const result = await session.browse({ nodeId, browseDirection });
	return {
		nodeId,
		statusCode: result.statusCode.toString(),
		references: (result.references ?? []).map((reference) => ({
			nodeId: reference.nodeId.toString(),
			browseName: reference.browseName.toString(),
			displayName: reference.displayName.text ?? '',
			nodeClass: reference.nodeClass,
			referenceTypeId: reference.referenceTypeId.toString(),
			isForward: reference.isForward,
		})),
	};
}

function coerceValue(this: IExecuteFunctions, dataType: string, value: unknown): unknown {
	if (dataType === 'string') return String(value);
	if (dataType === 'boolean') return value === true || value === 'true';
	if (dataType === 'dateTime') {
		const date = new Date(String(value));
		if (Number.isNaN(date.getTime())) throw new NodeOperationError(this.getNode(), 'Date and Time must be a valid ISO 8601 date');
		return date;
	}
	const numberValue = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(numberValue)) throw new NodeOperationError(this.getNode(), `${dataType} must be a valid number`);
	return numberValue;
}

function toJsonValue(value: unknown): JsonValue {
	if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
	if (value instanceof Date) return value.toISOString();
	if (Buffer.isBuffer(value)) return value.toString('base64');
	if (Array.isArray(value)) return value.map(toJsonValue);
	if (typeof value === 'bigint') return value.toString();
	if (typeof value === 'object') return JSON.parse(JSON.stringify(value)) as JsonObject;
	return String(value);
}
