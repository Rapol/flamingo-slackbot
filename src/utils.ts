import config from './config';
import {
    ISlackUser,
    IStandupMeetingItem,
    IStandupQuestion,
} from './types';

const {
    QUESTIONS,
} = config;

export const getQuestionByOrder = (order: number) => {
    return QUESTIONS.find(q => q.order === order);
};

export const getTodaysDate = (): string => {
    return new Date().toISOString().split('T')[0];
};

export const formatStandupMeetingItem =
    (user: ISlackUser, date: string, question: IStandupQuestion): IStandupMeetingItem => {
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
        } as IStandupMeetingItem;
    };

export const formatResponse = (responses: IStandupQuestion[]) => {
    return responses.map(r => `*${r.text}*\n${r.response}`).join('\n');
};

export const checkUserStandupCompletition = (responses: IStandupQuestion[]) => {
    const completed = responses.length === QUESTIONS.length && responses.every(a => Boolean(a.response));
    const currentQuestionIndex = responses.length - 1;
    return {
        completed,
        currentQuestionIndex,
    };
};

export const formatStandupMeetingItemForSlack = (meetingResponses: IStandupMeetingItem[]) => {
    return meetingResponses.map(m => ({
        message: formatResponse(m.responses),
        username: m.username,
    }));
};
