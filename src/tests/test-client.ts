import axios from 'axios';

const port = process.env.PORT || 3007;
const host = process.env.API_HOST || 'localhost';
const protocol = process.env.API_PROTOCOL || 'http';
const API_BASE =
    process.env.API_URL || `${protocol}://${host}:${port}/api/v1/repair-bot`;

async function runRepairBotTests() {
    console.log('🧪 Starting Repair Bot API Tests...\n');

    const userId = 'test-user-' + Date.now();

    try {
        // Тест 1: Создание сессии
        console.log('1. 🚀 Testing session creation...');
        const startResponse = await axios.post(
            `${API_BASE}/sessions/${userId}/start`,
        );
        console.log('   ✅ Session created:', startResponse.data.currentState);

        await new Promise(resolve => setTimeout(resolve, 300));

        // Тест 2: Отправка проблемы
        console.log('2. 🔧 Testing problem description...');
        const problemResponse = await axios.post(
            `${API_BASE}/sessions/${userId}/event`,
            {
                type: 'DESCRIBE_PROBLEM',
                problem: 'Дверь скрипит при открывании',
            },
        );
        console.log(
            '   ✅ Problem processed:',
            problemResponse.data.currentState,
        );

        await new Promise(resolve => setTimeout(resolve, 300));

        // Тест 3: Получение состояния
        console.log('3. 📊 Testing state retrieval...');
        const stateResponse = await axios.get(
            `${API_BASE}/sessions/${userId}/state`,
        );
        console.log('   ✅ State retrieved:', stateResponse.data.currentState);
        console.log('   ✅ Context:', stateResponse.data.context);
        console.log('   ✅ History length:', stateResponse.data.history.length);

        // Тест 4: Подтверждение решения
        console.log('4. ✅ Testing solution confirmation...');
        const confirmResponse = await axios.post(
            `${API_BASE}/sessions/${userId}/event`,
            {
                type: 'CONFIRM',
            },
        );
        console.log(
            '   ✅ Solution confirmed:',
            confirmResponse.data.currentState,
        );

        await new Promise(resolve => setTimeout(resolve, 300));

        // Тест 5: Финальное состояние
        console.log('5. 📋 Testing final state...');
        const finalState = await axios.get(
            `${API_BASE}/sessions/${userId}/state`,
        );
        console.log('   ✅ Final state:', finalState.data.currentState);
        console.log(
            '   ✅ Total history entries:',
            finalState.data.history.length,
        );

        // Тест 6: Завершение сессии
        console.log('6. 🏁 Testing session end...');
        const endResponse = await axios.delete(
            `${API_BASE}/sessions/${userId}`,
        );
        console.log('   ✅ Session ended:', endResponse.data.message);

        console.log('\n🎉 All tests passed successfully!');
        console.log(
            '📈 Workflow: idle → awaitingProblem → solution → success → idle',
        );
    } catch (error: any) {
        console.error('\n❌ Test failed:');
        console.error('Error:', error.response?.data?.error || error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
        }
    }
}

// Запуск тестов
runRepairBotTests();
