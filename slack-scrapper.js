const inquirer = require('inquirer');
const fs = require('fs');
const yaml = require('js-yaml');
const { WebClient } = require('@slack/client');

const { BOT_TOKEN } = yaml.safeLoad(fs.readFileSync('./env.yml', 'utf8'));
const web = new WebClient(BOT_TOKEN);

async function getSlackHumanUsers() {
    const { members } = await web.users.list({
        limit: 400,
    });
    return members.filter(u => !u.is_bot);
}

function promptUserSelect(choices) {
    return inquirer
        .prompt([
            {
                type: 'checkbox',
                name: 'selectedUsers',
                message: 'Which users to add?',
                choices,
            }
        ])
}

async function main() {
    const users = await getSlackHumanUsers();
    const { selectedUsers } = await promptUserSelect(users);
    const result = users.filter(u => selectedUsers.find(s => s === u.name)).map(u => ({ userId: u.id, username: u.name }));
    console.log('Copy paste JSON to the USERS property field of ./src/config.ts');
    console.log(JSON.stringify(result, null, 2));
}

main();
