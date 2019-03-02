import { WebClient } from '@slack/client';

import config from './config';
import Storage from './storage';
import * as utils from './utils';

import {
    IEvent,
    ISlackEvent,
    ISlackUser,
    IStandupMeetingItem,
    IStandupQuestion,
} from './types';

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_REPORT = process.env.CHANNEL_REPORT;

const web = new WebClient(BOT_TOKEN);
const storage = new Storage(process.env.FLAMING_MEETING_TABLE);

const {
    USERS,
    QUESTIONS,
} = config;

const CHANNEL_REPORT_ID = getReportChannelId();

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

// Send message to channel
function sendMessageToChannel(channel: string, username: string, text: string, threadTS: string): Promise<any> {
    return web.chat.postMessage({
        channel,
        text,
        threadTS,
        username,
    });
}

async function getReportChannelId() {
    const param = {
        exclude_archived: true,
        limit: 100,
        types: 'public_channel',
    };
    const result: any = await web.conversations.list(param);
    const channel = result.channels.find(c => c.name === CHANNEL_REPORT);
    return channel ? channel.id : '';
}

async function threadMessages(channel: string, messages: any[]): Promise<any> {
    const { message } = await sendMessageToChannel(channel, null, 'Hey! These are everyone\'s problem', null);
    const { ts } = message;
    return Promise.all(messages.map(m => sendMessageToChannel(channel, m.username, m.message, ts)));
}

async function recordMessage(user: ISlackUser, question: IStandupQuestion) {
    const dateKey = utils.getTodaysDate();
    await sendMessageToUser(user.userId, question.text);
    await storage.createStandupMeetingItem(utils.formatStandupMeetingItem(user, dateKey, question));
}

async function askNextQuestion(userId: string, date: string, question: IStandupQuestion) {
    await sendMessageToUser(userId, question.text);
    await storage.askNextQuestion(userId, date, question);
}

function getUserStandupStatus(userId: string, date: string) {
    return storage.getStandupMeetingItem(userId, date);
}

async function handleUserReply(slackMessage: IEvent) {
    const {
        user: userId,
        text,
    } = slackMessage;
    const date = utils.getTodaysDate();
    // TODO: check if the event_time is between the stand up time
    const standupMeetingItem = await getUserStandupStatus(userId, date);
    // user is not part of the cool kids
    if (!standupMeetingItem) {
        // talk to the hand
        return;
    }
    const {
        responses,
    } = standupMeetingItem;
    const {
        completed,
        currentQuestionIndex,
    } = utils.checkUserStandupCompletition(responses);
    if (completed) {
        return sendMessageToUser(userId, 'You have already sent your update');
    }
    await storage.updateUserResponse(userId, date, currentQuestionIndex, text);
    if (currentQuestionIndex === QUESTIONS.length - 1) {
        return sendMessageToUser(userId, 'Great! All caught up, have a nice day');
    }
    await askNextQuestion(userId, date, QUESTIONS[currentQuestionIndex + 1]);
}

async function createReport(channel, standUpMeetingItems: IStandupMeetingItem[]) {
    const userThreadMessages = utils.formatStandupMeetingItemForSlack(standUpMeetingItems);
    await threadMessages(channel, userThreadMessages);
}

export const startMeeting = async () => {
    const sentMessages = USERS.map(u => recordMessage(u, utils.getQuestionByOrder(0)));
    return Promise.all(sentMessages);
};

export const endMeeting = async () => {
    const date = utils.getTodaysDate();
    const meetingResponses = await storage.batchGetStandupMeetingItems(USERS, date);
    const channelId = await CHANNEL_REPORT_ID;
    if (meetingResponses.length === 0) {
        return sendMessageToChannel(channelId, null, 'Nobody sent their problems :(', null);
    }
    return createReport(channelId, meetingResponses);
};

export const bot = async (slackEvent: ISlackEvent) => {
    const {
        event: slackMessage,
    } = slackEvent;
    console.log(slackEvent);
    if (slackMessage.bot_id || slackMessage.subtype === 'bot_message') {
        return {
            statusCode: 200,
        };
    }
    await handleUserReply(slackMessage);
    return {
        statusCode: 200,
    };
};

