
const { execSync } = require('child_process');
const fs = require('fs');
const output = execSync('git log --pretty=format:"%h - %cd - %s" --date=local -n 30', { encoding: 'utf8' });
fs.writeFileSync('c:\\Users\\둥이컴\\dorm3\\git_logs2.txt', output, 'utf8');
