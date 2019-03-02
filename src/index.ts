import { APIGatewayEvent, Context, Handler } from 'aws-lambda';

import * as slack from './slack';

import { ISlackEvent } from './types';

function parseEvent(event: APIGatewayEvent): ISlackEvent {
    return (event.body && typeof event.body === 'string') ? JSON.parse(event.body) : event.body;
}

export const scheduler = async (event: any, context: Context) => {
    if (event.type === process.env.START_MEETING) {
        return slack.startMeeting();
    } else if (event.type === process.env.END_MEETING) {
        return slack.endMeeting();
    }
    return null;
};

export const botHandler: Handler = async (event: APIGatewayEvent, context: Context) => {
    const slackEvent = parseEvent(event);
    if (!slackEvent) {
        return {
            statusCode: 200,
        };
    }
    return slack.bot(slackEvent);
};

