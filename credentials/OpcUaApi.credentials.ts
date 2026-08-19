import type { ICredentialType, INodeProperties, Icon } from 'n8n-workflow';

export class OpcUaApi implements ICredentialType {
	name = 'opcUaApi';
	displayName = 'OPC UA API';
	documentationUrl = 'https://opcfoundation.org/about/opc-technologies/opc-ua/';
	icon: Icon = { light: 'file:../nodes/OpcUa/opcua.png', dark: 'file:../nodes/OpcUa/opcua.dark.png' };

	properties: INodeProperties[] = [
		{
			displayName: 'Endpoint URL',
			name: 'endpointUrl',
			type: 'string',
			required: true,
			default: '',
			placeholder: 'opc.tcp://192.168.1.10:4840',
			description: 'OPC UA endpoint exposed by the PLC or server',
		},
		{
			displayName: 'Security Mode',
			name: 'securityMode',
			type: 'options',
			options: [
				{ name: 'None', value: 'None' },
				{ name: 'Sign', value: 'Sign' },
				{ name: 'Sign and Encrypt', value: 'SignAndEncrypt' },
			],
			default: 'None',
			description: 'Message security mode required by the OPC UA endpoint',
		},
		{
			displayName: 'Security Policy',
			name: 'securityPolicy',
			type: 'options',
			options: [
				{ name: 'None', value: 'None' },
				{ name: 'Basic256Sha256', value: 'Basic256Sha256' },
				{ name: 'Aes128_Sha256_RsaOaep', value: 'Aes128_Sha256_RsaOaep' },
				{ name: 'Aes256_Sha256_RsaPss', value: 'Aes256_Sha256_RsaPss' },
			],
			default: 'None',
			description: 'Security policy required by the OPC UA endpoint',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'options',
			options: [
				{ name: 'Anonymous', value: 'anonymous' },
				{ name: 'Username and Password', value: 'usernamePassword' },
			],
			default: 'anonymous',
		},
		{
			displayName: 'Username',
			name: 'username',
			type: 'string',
			required: true,
			default: '',
			displayOptions: { show: { authentication: ['usernamePassword'] } },
		},
		{
			displayName: 'Password',
			name: 'password',
			type: 'string',
			required: true,
			typeOptions: { password: true },
			default: '',
			displayOptions: { show: { authentication: ['usernamePassword'] } },
		},
		{
			displayName: 'Connection Timeout',
			name: 'connectionTimeout',
			type: 'number',
			default: 10000,
			typeOptions: { minValue: 1000 },
			description: 'Maximum time in milliseconds to establish a connection',
		},
	];
}
