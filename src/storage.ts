import { AWSError, DynamoDB } from 'aws-sdk';
import { PromiseResult } from 'aws-sdk/lib/request';

import { ISlackUser, IStandupMeetingItem, IStandupQuestion } from './types';

export default class StorageAdapter {
    private dynamoClient: DynamoDB.DocumentClient;
    private tableName: string;

    constructor(tableName: string) {
        this.tableName = tableName;
        this.dynamoClient = new DynamoDB.DocumentClient();
    }

    public createStandupMeetingItem(item: IStandupMeetingItem)
        : Promise<PromiseResult<DynamoDB.DocumentClient.PutItemOutput, AWSError>> {
        const itemInput: DynamoDB.DocumentClient.PutItemInput = {
            Item: item,
            TableName: this.tableName,
        };
        return this.dynamoClient.put(itemInput).promise();
    }

    public async getStandupMeetingItem(userId: string, date: string): Promise<DynamoDB.DocumentClient.AttributeMap> {
        const itemInput: DynamoDB.DocumentClient.GetItemInput = {
            Key: {
                date,
                userId,
            },
            TableName: this.tableName,
        };
        const { Item } = await this.dynamoClient.get(itemInput).promise();
        return Item;
    }

    public async batchGetStandupMeetingItems(users: ISlackUser[], date: string): Promise<IStandupMeetingItem[]> {
        const itemInput: DynamoDB.DocumentClient.BatchGetItemInput = {
            RequestItems: {
                [this.tableName]: {
                    Keys: users.map(u => ({
                        date,
                        userId: u.userId,
                    })),
                },
            },
        };
        const result = await this.dynamoClient.batchGet(itemInput).promise();
        const standUpMeetingItems = result.Responses[this.tableName] || [];
        return standUpMeetingItems as IStandupMeetingItem[];
    }

    public async updateUserResponse(userId: string, date: string, questionOrder, response: string) {
        const itemInput: DynamoDB.DocumentClient.UpdateItemInput = {
            ExpressionAttributeNames: {
                '#r': 'response',
            },
            ExpressionAttributeValues: {
                ':response': response,
            },
            Key: {
                date,
                userId,
            },
            TableName: this.tableName,
            UpdateExpression: `SET responses[${questionOrder}].#r = :response`,
        };
        return this.dynamoClient.update(itemInput).promise();
    }

    public async askNextQuestion(userId: string, date: string, question: IStandupQuestion) {
        const itemInput: DynamoDB.DocumentClient.UpdateItemInput = {
            TableName: this.tableName,
            Key: {
                userId,
                date,
            },
            UpdateExpression: 'SET #r = list_append(#r, :vals)',
            ExpressionAttributeNames: {
                '#r': 'responses',
            },
            ExpressionAttributeValues: {
                ':vals': [question],
            },
        };
        return this.dynamoClient.update(itemInput).promise();
    }
}
