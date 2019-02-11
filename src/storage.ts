import { DynamoDB, AWSError } from 'aws-sdk';
import { PromiseResult } from 'aws-sdk/lib/request';

import { StandupMeetingItem, SlackUser, StandupQuestion } from './types';

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

    async batchGetStandupMeetingItems(users: SlackUser[], date: string): Promise<StandupMeetingItem[]> {
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
        const result = await this.dynamoClient.batchGet(itemInput).promise();
        const standUpMeetingItems = result.Responses[this.tableName] || [];
        return standUpMeetingItems as StandupMeetingItem[];
    }

    async updateUserResponse(userId: String, date: string, questionOrder, response: string) {
        const itemInput: DynamoDB.DocumentClient.UpdateItemInput = {
            TableName: this.tableName,
            Key: {
                userId,
                date,
            },
            UpdateExpression: `SET responses[${questionOrder}].#r = :response`,
            ExpressionAttributeNames: {
                "#r": "response",
            },
            ExpressionAttributeValues: {
                ":response": response,
            },
        };
        return this.dynamoClient.update(itemInput).promise();
    }

    async askNextQuestion(userId: String, date: string, question: StandupQuestion) {
        const itemInput: DynamoDB.DocumentClient.UpdateItemInput = {
            TableName: this.tableName,
            Key: {
                userId,
                date,
            },
            UpdateExpression: "SET #r = list_append(#r, :vals)",
            ExpressionAttributeNames: {
                "#r": "responses",
            },
            ExpressionAttributeValues: {
                ":vals": [question],
            },
        };
        return this.dynamoClient.update(itemInput).promise();
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