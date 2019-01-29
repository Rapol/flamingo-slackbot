import { DynamoDB, AWSError } from 'aws-sdk';
import { PromiseResult } from 'aws-sdk/lib/request';

import { StandupMeetingItem, SlackUser } from './types';

export default class StorageAdapter {
    dynamoClient: DynamoDB.DocumentClient;
    tableName: string;

    constructor(tableName: string) {
        this.tableName = tableName;
        this.dynamoClient = new DynamoDB.DocumentClient();
    }

    createStandupMeetingItem(item: StandupMeetingItem): Promise<PromiseResult<DynamoDB.DocumentClient.PutItemOutput, AWSError>> {
        const itemInput: DynamoDB.DocumentClient.PutItemInput = {
            TableName: this.tableName,
            Item: item,
        }
        return this.dynamoClient.put(itemInput).promise();
    }

    async getStandupMeetingItem(userId: string, date: string): Promise<DynamoDB.DocumentClient.AttributeMap> {
        const itemInput: DynamoDB.DocumentClient.GetItemInput = {
            TableName: this.tableName,
            Key: {
                userId,
                date,
            }
        }
        const { Item } = await this.dynamoClient.get(itemInput).promise();
        return Item;
    }

    async batchGetStandupMeetingItem(users: SlackUser[], date: string): Promise<DynamoDB.DocumentClient.BatchGetResponseMap> {
        const itemInput: DynamoDB.DocumentClient.BatchGetItemInput = {
            RequestItems: {
                [this.tableName]: {
                    Keys: users.map(u => ({
                        userId: u.userId,
                        date,
                    }))
                }
            }
        }
        const { Responses } = await this.dynamoClient.batchGet(itemInput).promise();
        return Responses;
    }

    updateItem(userId: string, date: string, item: object): Promise<PromiseResult<DynamoDB.DocumentClient.UpdateItemOutput, AWSError>> {
        const [updateExpression, expressionAttributeValues] = this.getUpdateParams(item);
        const itemInput: DynamoDB.DocumentClient.UpdateItemInput = {
            TableName: this.tableName,
            Key: {
                userId,
                date,
            },
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues,
        };
        return this.dynamoClient.update(itemInput).promise();
    }

    private getUpdateParams(item): [DynamoDB.DocumentClient.UpdateExpression, DynamoDB.DocumentClient.ExpressionAttributeValueMap] {
        const keys = Object.keys(item);
        let updateExpression = '';
        let expressionAttributeValues = {};
        for (const key of keys) {
            updateExpression += `${key}=:${key},`;
            expressionAttributeValues[`:${key}`] = item[key];
        }
        return [updateExpression, expressionAttributeValues]
    }
}