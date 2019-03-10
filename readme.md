
# flamingo bot

![flamingos](https://media.giphy.com/media/10gZNwuUuer5aU/giphy.gif)

A serverless slack bot that handles standup meeting via Slack!

When the meeting starts, participants will be sent the usual three questions:

> What did you do yesterday
> What are you going to do today?
> Any blockers?

Participants will respond to each question individually and the bot will compile the answers.
At the end of the meeting, the bot will generate a report in the configured channel.

## Deployment

Configure the AWS profiles for each environment you want to deploy in serverless.yml

```
custom:
  profiles:
    dev: your-dev-profile
```

To deploy run:

`npm run deploy:dev`

or set NODE_ENV to the desire environment and run:

`EXPORT=prod npm run deploy`


## Configuration

### Bot Configuration

TODO

### Standup Participants

To configure who is going to participate in the standup you must gather the slack id and name of each 
user. 

The slack-user-scrapper script will help you on this by listing all users in your workspace and giving you the 
option to select them.

When you have the list of users, configure ./src/config.ts like this:

```
export default {
    USERS: [
        {
            userId: 'UFLFZ8HNE',
            username: 'ducky',
        },
    ],
} as IConfig;
```

### Standup Time

Cron expressions are used to describe start and end time meeting. Modify this in env.yml. Example:
```
# Start meeting at 10:00am weekdays
MEETING_START_TIME: "cron(0 10 ? * MON-FRI *)"
# End meeting at 10:30am weekdays
MEETING_END_TIME: "cron(30 10 ? * MON-FRI *)"
```

### Questions

To modify questions, update ./src/config.ts:

```
export default {
    QUESTIONS: [
        {
            // any string
            questionId: 'WDYDY',
            // represents the order of the questions
            order: 0,
            // Question to be asked
            text: 'What did you do yesterday',
        }
    ],
} as IConfig;
```