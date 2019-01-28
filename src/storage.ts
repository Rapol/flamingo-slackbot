import { DynamoDB, AWSError } from 'aws-sdk';
import { PromiseResult } from 'aws-sdk/lib/request';

import { StandupRecord, SlackUser } from './types';

export default class StorageAdapter {
    dynamoClient: DynamoDB.DocumentClient;
    tableName: string;

    constructor(tableName: string) {
        this.tableName = tableName;
        this.dynamoClient = new DynamoDB.DocumentClient();
    }

    createStandupRecord(item: StandupRecord): Promise<PromiseResult<DynamoDB.DocumentClient.PutItemOutput, AWSError>> {
        const itemInput: DynamoDB.DocumentClient.PutItemInput = {
            TableName: this.tableName,
            Item: item,
        }
        console.log(itemInput);
        return this.dynamoClient.put(itemInput).promise();
    }

    getStandupRecord(userId: string, date: string): Promise<PromiseResult<DynamoDB.DocumentClient.GetItemOutput, AWSError>> {
        const itemInput: DynamoDB.DocumentClient.GetItemInput = {
            TableName: this.tableName,
            Key: {
                userId,
                date,
            }
        }
        return this.dynamoClient.get(itemInput).promise();
    }

    batchGetStandupRecord(users: SlackUser[], date: string): Promise<PromiseResult<DynamoDB.DocumentClient.BatchGetItemOutput, AWSError>> {
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
        return this.dynamoClient.batchGet(itemInput).promise();
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