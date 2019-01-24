import { APIGatewayEvent, Callback, Context, Handler } from 'aws-lambda';
import axios from 'axios';
import { WebClient } from '@slack/client';

const BOT_TOKEN = "xoxb-529939959697-529970989809-hPRp3baWl6Trki4C2TKDYeBk";

const web = new WebClient(BOT_TOKEN);

const SLACK_URL = 'https://slack.com/api';
const POST_MESSAGE_METHOD = '/chat.postMessage'

const axiosInstance = axios.create({
  baseURL: SLACK_URL,
  timeout: 1000,
  headers: { 'Content-Type': 'application/json' }
});

export const bot: Handler = async (event: APIGatewayEvent, context: Context, cb: Callback) => {
  if (!event.body) {
    return {
      statusCode: 200,
    };
  }
  const slackMessage: any = JSON.parse(event.body);
  const {
    event: slackEvent
  } = slackMessage;
  console.log(slackEvent);
  if (slackEvent.bot_id || slackEvent.subtype === 'bot_message') {
    return {
      statusCode: 200,
    };
  }
  const {
    channel,
    text,
  } = slackEvent;
  const result = await web.chat.postMessage({
    channel,
    text: text.split('').reverse().join(''),
  });
  return {
    statusCode: 200,
  };
}

