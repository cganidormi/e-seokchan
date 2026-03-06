
const bcrypt = require('bcryptjs');

const targetHash = '$2a$10$pGLybDC6sIMreApv.WYsjSHJErEO8NWDTENXdop.';
const commonPasswords = ['권용표', '1234', '1234qwer', '0000', '1111'];

async function check() {
    for (const pw of commonPasswords) {
        const match = await bcrypt.compare(pw, targetHash);
        if (match) {
            console.log(`Found match: ${pw}`);
            return;
        }
    }
    console.log('No match found among common default passwords.');
}

check();
