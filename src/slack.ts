import { WebClient } from '@slack/client';

import Storage from './storage';
import config from './config';
import { Event, SlackEvent, SlackUser, StandupQuestion, StandupMeetingItem } from './types';

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHANNEL_REPORT = process.env.CHANNEL_REPORT;

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
        date,
        answers: [
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

async function recordMessage(user: SlackUser, question: StandupQuestion) {
    await sendMessageToUser(user.userId, question.text);
    const dateKey = getTodaysDate();
    await storage.createStandupMeetingItem(formatStandupMeetingItem(user, dateKey, question));
}

export const startMeeting = async () => {
    const sentMessages = USERS.map(u => recordMessage(u, getQuestionByOrder(0)));
    return Promise.all(sentMessages);
}

function checkUserStandupCompletition(answers: StandupQuestion[]) {
    return answers.length === QUESTIONS.length && answers.every(a => Boolean(a.text));
}

function getUserStandupStatus(userId: string, date: string) {
    return storage.getStandupMeetingItem(userId, date);
}

async function handleUserReply(slackMessage: Event) {
    const {
        user,
        answers,
    } = slackMessage;
    // TODO: check if the event_time is between the stand up time
    const standupMeetingItem = await getUserStandupStatus(user, getTodaysDate());
    console.log(standupMeetingItem);
    if (checkUserStandupCompletition(answers)) {
        await sendMessageToUser(user, 'You have already sent your update');
    }
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
    await handleUserReply(slackMessage);
    return {
        statusCode: 200,
    };
}

