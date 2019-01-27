import { APIGatewayEvent, Callback, Context, Handler } from 'aws-lambda';

import { startMeeting, slackBot } from './slack';

import { SlackEvent } from './types';

function parseEvent(event: APIGatewayEvent): SlackEvent {
    return event.body ? JSON.parse(event.body) : null;
}
export const startMeetingHandler : Handler = async (event: APIGatewayEvent, context: Context, cb: Callback) => {
    return startMeeting();
}

function meetingReport() {

}

export const meetingEnd = async (event: APIGatewayEvent, context: Context, cb: Callback) => {
    const slackEvent = parseEvent(event);

}

export const botHandler: Handler = async (event: APIGatewayEvent, context: Context, cb: Callback) => {
    const slackEvent = parseEvent(event);
    if (!slackEvent) {
        return {
            statusCode: 200,
        };
    }
    return slackBot(slackEvent);
}

