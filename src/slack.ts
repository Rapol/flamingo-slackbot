import { WebClient } from '@slack/client';

import Storage from './storage';
import config from './config';
import { Event, SlackEvent, SlackUser, StandupQuestion, StandupMeetingItem } from './types';

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_REPORT = process.env.CHANNEL_REPORT;
let CHANNEL_REPORT_ID;

const storage = new Storage(process.env.FLAMING_MEETING_TABLE)

const {
    USERS,
    QUESTIONS,
} = config;

const web = new WebClient(BOT_TOKEN);

function getQuestionByOrder(order: number) {
    return QUESTIONS.find(q => q.order === order);
}

function getTodaysDate(): string {
    return new Date().toISOString().split('T')[0];
}

function formatStandupMeetingItem(user: SlackUser, date: string, question: StandupQuestion): StandupMeetingItem {
    return <StandupMeetingItem>{
        userId: user.userId,
        username: user.username,
        date,
        responses: [
            {
                ...question,
                createdAt: Date.now(),
            }
        ]
    }
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
function sendMessageToChannel(channel: string, username: string, text: string, thread_ts: string): Promise<any> {
    return web.chat.postMessage({
        channel,
        text,
        username,
        thread_ts,
    });
}

async function getReportChannelId() {
    if (CHANNEL_REPORT_ID) {
        return CHANNEL_REPORT_ID;
    }
    const param = {
        exclude_archived: true,
        types: 'public_channel',
        // Only get first 100 items
        limit: 100
    };
    const result: any = await web.conversations.list(param);
    const channel = result.channels.find(c => c.name == CHANNEL_REPORT);
    CHANNEL_REPORT_ID = channel ? channel.id : '';
    return CHANNEL_REPORT_ID;
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
        username: m.username,
        message: formatResponse(m.responses),
    }))
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
    const completed = responses.length === QUESTIONS.length && responses.every(a => Boolean(a.response))
    const currentQuestionIndex = responses.length - 1;
    return {
        completed,
        currentQuestionIndex,
    }
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

async function createReport(standUpMeetingItems: StandupMeetingItem[]) {
    const userThreadMessages = formatStandupMeetingItemForSlack(standUpMeetingItems);
    await threadMessages(CHANNEL_REPORT_ID, userThreadMessages);
}

export const startMeeting = async () => {
    const sentMessages = USERS.map(u => recordMessage(u, getQuestionByOrder(0)));
    return Promise.all(sentMessages);
}

export const endMeeting = async () => {
    const date = getTodaysDate();
    const meetingResponses = await storage.batchGetStandupMeetingItems(USERS, date);
    await getReportChannelId();
    if (meetingResponses.length === 0) {
        return sendMessageToChannel(CHANNEL_REPORT_ID, null, 'Nobody sent their problems :(', null);
    }
    return createReport(meetingResponses);
}

export const bot = async (slackEvent: SlackEvent) => {
    const {
        event: slackMessage
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
}

