import { Readable } from 'stream';

async function* chunkStream(stream: Readable): AsyncGenerator<Buffer> {
    const chunkSize = 1024 * 1024; // 1 megabyte
    let buffer: Buffer = Buffer.alloc(chunkSize);
    let offset: number = 0;

    for await (const chunk of stream) {
        let position = 0;
        while (position < chunk.length) {
            const spaceLeft = chunkSize - offset;
            const chunkToCopy = Math.min(spaceLeft, chunk.length - position);

            chunk.copy(buffer, offset, position, position + chunkToCopy);

            position += chunkToCopy;
            offset += chunkToCopy;

            if (offset === chunkSize) {
                yield buffer;
                buffer = Buffer.alloc(chunkSize);
                offset = 0;
            }
        }
    }

    if (offset > 0) {
        yield buffer.slice(0, offset);
    }
}

// Usage example
import { createReadStream } from 'fs';

async function main() {
    const stream = createReadStream('./VID.mp4');
    let i = 0;
    for await (const chunk of chunkStream(stream)) {
        i++;
        console.log(`Received chunk of size: ${chunk.length} bytes`);
    }
    console.log(i);
}

main().catch(err => {
    console.error('An error occurred:', err);
});
