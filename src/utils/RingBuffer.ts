
export default class RingBuffer<T> {
    private buffer: T[];
    private insertPtr: number;
    private readPtr: number;
    private size: number;
    private capacity: number;

    constructor(capacity: number) {
        this.capacity = capacity;
        this.buffer = new Array<T>(capacity);
        this.insertPtr = -1;
        this.readPtr = -1;
        this.size = 0;
    }

    
    enqueue(data: T){
        this.insertPtr++;
        this.insertPtr %= this.capacity;

        this.buffer[this.insertPtr] = data;
        if(this.readPtr == this.insertPtr){
            this.readPtr = (this.readPtr + 1) % this.capacity;

        }
        if(this.size !== this.capacity)
            this.size++;
    }

    dequeue() : T {
        if(this.insertPtr === this.readPtr) throw new Error("Buffer Underflow");
        this.size--;
        this.readPtr = (this.readPtr + 1) % this.capacity;
        const out = this.buffer[this.readPtr];
        this.buffer[this.readPtr];
        return out;
    }

    isEmpty() : boolean {
        return this.size === 0;
    }

    isFull() : boolean {
        return this.size === this.capacity;
    }
    // Methods for your ring buffer (e.g., enqueue, dequeue, etc.)
}


