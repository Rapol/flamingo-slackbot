import { WebClient } from '@slack/client';

import config from './config';
import Storage from './storage';

import {
    Event,
    SlackEvent,
    SlackUser,
    StandupMeetingItem,
    StandupQuestion,
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

function getQuestionByOrder(order: number) {
    return QUESTIONS.find(q => q.order === order);
}

function getTodaysDate(): string {
    return new Date().toISOString().split('T')[0];
}

function formatStandupMeetingItem(user: SlackUser, date: string, question: StandupQuestion): StandupMeetingItem {
    return {
        date,
        responses: [
            {
                ...question,
                createdAt: Date.now(),
            },
        ],
        userId: user.userId,
        username: user.username,
    } as StandupMeetingItem;
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

function formatResponse(responses: StandupQuestion[]) {
    return responses.map(r => `*${r.text}*\n${r.response}`).join('\n');
}

function formatStandupMeetingItemForSlack(meetingResponses: StandupMeetingItem[]) {
    return meetingResponses.map(m => ({
        message: formatResponse(m.responses),
        username: m.username,
    }));
}

async function recordMessage(user: SlackUser, question: StandupQuestion) {
    await sendMessageToUser(user.userId, question.text);
    const dateKey = getTodaysDate();
    await storage.createStandupMeetingItem(formatStandupMeetingItem(user, dateKey, question));
}

async function askNextQuestion(userId: string, date: string, question: StandupQuestion) {
    await sendMessageToUser(userId, question.text);
    await storage.askNextQuestion(userId, date, question);
}

function checkUserStandupCompletition(responses: StandupQuestion[]) {
    const completed = responses.length === QUESTIONS.length && responses.every(a => Boolean(a.response));
    const currentQuestionIndex = responses.length - 1;
    return {
        completed,
        currentQuestionIndex,
    };
}

function getUserStandupStatus(userId: string, date: string) {
    return storage.getStandupMeetingItem(userId, date);
}

async function handleUserReply(slackMessage: Event) {
    const {
        user,
        text,
    } = slackMessage;
    const date = getTodaysDate();
    // TODO: check if the event_time is between the stand up time
    const standupMeetingItem = await getUserStandupStatus(user, date);
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
    } = checkUserStandupCompletition(responses);
    if (completed) {
        return sendMessageToUser(user, 'You have already sent your update');
    }
    await storage.updateUserResponse(user, date, currentQuestionIndex, text);
    if (currentQuestionIndex === QUESTIONS.length - 1) {
        return sendMessageToUser(user, 'Great! All caught up, have a nice day');
    }
    await askNextQuestion(user, date, QUESTIONS[currentQuestionIndex + 1]);
}

async function createReport(channel, standUpMeetingItems: StandupMeetingItem[]) {
    const userThreadMessages = formatStandupMeetingItemForSlack(standUpMeetingItems);
    await threadMessages(channel, userThreadMessages);
}

export const startMeeting = async () => {
    const sentMessages = USERS.map(u => recordMessage(u, getQuestionByOrder(0)));
    return Promise.all(sentMessages);
};

export const endMeeting = async () => {
    const date = getTodaysDate();
    const meetingResponses = await storage.batchGetStandupMeetingItems(USERS, date);
    const channelId = await CHANNEL_REPORT_ID;
    if (meetingResponses.length === 0) {
        return sendMessageToChannel(channelId, null, 'Nobody sent their problems :(', null);
    }
    return createReport(channelId, meetingResponses);
};

export const bot = async (slackEvent: SlackEvent) => {
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

