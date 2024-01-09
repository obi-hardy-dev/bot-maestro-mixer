import RingBuffer from '../src/utils/RingBuffer';

describe('RingBuffer for Audio Data', () => {
    const bufferSize = 1024; // Example buffer size
    let audioBuffer: RingBuffer<number>;

    beforeEach(() => {
        audioBuffer = new RingBuffer<number>(bufferSize);
    });

    it('should initialize an empty buffer with specified capacity', () => {
        expect(audioBuffer.isEmpty()).toBe(true);
        expect(audioBuffer.isFull()).toBe(false);
        // Add more assertions if your RingBuffer class has methods to check its size or capacity
    });

    it('should enqueue and dequeue audio data correctly', () => {
        const sampleData = [1, 2, 3]; // Replace with actual audio data
        sampleData.forEach(data => audioBuffer.enqueue(data));

        expect(audioBuffer.dequeue()).toBe(sampleData[0]);
        expect(audioBuffer.dequeue()).toBe(sampleData[1]);
        // Continue with more assertions
    });

    it('should handle buffer overflow gracefully', () => {
        for (let i = 0; i < bufferSize; i++) {
            audioBuffer.enqueue(i);
        }

        // Assuming your buffer overwrites old data on overflow
        // Adjust this test based on how your buffer handles overflow
        audioBuffer.enqueue(2048);
        expect(audioBuffer.isFull()).toBe(true);
        // Add assertions to check the state after overflow
    });

    it('should handle buffer underflow gracefully', () => {
        expect(() => audioBuffer.dequeue()).toThrow();
        // Add more assertions if your buffer has specific underflow behaviors
    });

    it('should maintain data integrity', () => {
        const testData = Array.from({ length: bufferSize }, (_, i) => i);
        testData.forEach(data => audioBuffer.enqueue(data));

        testData.forEach(expectedData => {
            const dequeuedData = audioBuffer.dequeue();
            expect(dequeuedData).toBe(expectedData);
        });

        expect(audioBuffer.isEmpty()).toBe(true);
    });

    // Additional tests can be written for other scenarios
});
