import { WebClient } from '@slack/client';

import config from './config';
import { SlackEvent } from './types';

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_REPORT = process.env.CHANNEL_REPORT;

const {
    USERS,
    QUESTIONS,
} = config;

const web = new WebClient(BOT_TOKEN);

function getQuestionByOrder(order: number) {
    return QUESTIONS.find(q => q.order === order);
}

// Open a DM with the user and send a message to it.
// Returns channel id of the user
async function sendMessageToUser(userId: string, text: string): Promise<string> {
    const { channel }: any = await web.im.open({
        user: userId,
    });
    if (!channel && !channel.id) {
        return '';
    }
    await web.chat.postMessage({
        channel: channel.id,
        text,
    });
    return channel.id;
}

export const startMeeting = async () => {
    const sentMessages = USERS.map(u => sendMessageToUser(u.userId, getQuestionByOrder(0).text));
    return Promise.all(sentMessages);
}

export const slackBot = async (slackEvent: SlackEvent) => {
    const {
        event: slackMessage
    } = slackEvent;
    console.log(slackEvent);
    if (slackMessage.bot_id || slackMessage.subtype === 'bot_message') {
        return {
            statusCode: 200,
        };
    }
    const {
        channel,
        text,
    } = slackMessage;
    const result = await web.chat.postMessage({
        channel,
        text: text.split('').reverse().join(''),
    });
    return {
        statusCode: 200,
    };
}

