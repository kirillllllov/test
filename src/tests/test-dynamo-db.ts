
import counterService from '../services/counter-service.js';

async function testDynamoDb() {
    console.log('🧪 Testing DynamoDB connection with DynamoDB Toolbox...');

    try {
        // Тест 1: Получить текущее значение
        console.log('1. Getting current count...');
        const currentCount = await counterService.getCurrentCount();
        console.log('   ✅ Current count:', currentCount);

        // Тест 2: Увеличить счётчик
        console.log('2. Incrementing counter...');
        const newCount = await counterService.incrementCounter();
        console.log('   ✅ New count:', newCount);

        // Тест 3: Ещё раз увеличить
        console.log('3. Incrementing again...');
        const finalCount = await counterService.incrementCounter();
        console.log('   ✅ Final count:', finalCount);

        console.log('🎉 DynamoDB test completed successfully!');
    } catch (error) {
        console.error('❌ DynamoDB test failed:', error);
    }
}

testDynamoDb();
