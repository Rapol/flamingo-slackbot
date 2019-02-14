
#flamingo bot

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
