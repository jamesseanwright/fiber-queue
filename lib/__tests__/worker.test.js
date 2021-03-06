'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const createWorker = require('../worker');

describe('the worker', function () {
    let worker;
    let mockProcess;

    beforeEach(function () {
        const process = {
            stdout: {
                pipe: () => undefined,
            },

            on: () => undefined,
            send: () => undefined,
            removeListener: () => undefined,
            kill: () => undefined,
        };

        mockProcess = sinon.mock(process);
        worker = createWorker(process);
    });

    afterEach(function () {
        mockProcess.restore();
    });

    describe('the kill method', function () {
        it('should kill the underlying child process', function () {
            mockProcess.expects('kill')
                .once();

            worker.kill();
            mockProcess.verify();
        });
    });

    describe('the run method', function () {
        afterEach(function () {
            if (process.hrtime.restore) {
                process.hrtime.restore();
            }
        });

        it('should run the payload to the child process and proxy the result', async function () {
            const seconds = 20;
            const nanoseconds = 1;
            const requestId = `${seconds}${nanoseconds}`;
            const payload = { foo: 'bar' };
            const expectedResult = { bar: 'baz', requestId };

            mockProcess.expects('on')
                .withArgs('message', sinon.match.func)
                .once()
                .callsArgWith(1, expectedResult);

            mockProcess.expects('on')
                .withArgs('error', sinon.match.func)
                .once();

            mockProcess.expects('send')
                .once()
                .withArgs({ ...payload, requestId });

            sinon.stub(process, 'hrtime')
                .returns([seconds, nanoseconds]);

            const actualResult = await worker.run(payload);

            expect(actualResult).to.deep.equal(expectedResult);
            mockProcess.verify();
        });

        it('should remove relevant event listeners when a message is received', async function () {
            const seconds = 20;
            const nanoseconds = 1;
            const requestId = `${seconds}${nanoseconds}`;

            mockProcess.expects('on')
                .withArgs('message', sinon.match.func)
                .once()
                .callsArgWith(1, { requestId });

            mockProcess.expects('on')
                .withArgs('error', sinon.match.func)
                .once();

            mockProcess.expects('send')
                .once()
                .withArgs({ requestId });

            mockProcess.expects('removeListener')
                .withArgs('message', sinon.match.func)
                .onFirstCall();

            mockProcess.expects('removeListener')
                .withArgs('error', sinon.match.func)
                .onSecondCall();

            sinon.stub(process, 'hrtime')
                .returns([seconds, nanoseconds]);

            await worker.run({});

            mockProcess.verify();
        });

        it('should remove relevant event listeners when an error is encountered', async function () {
            const seconds = 20;
            const nanoseconds = 1;
            const requestId = `${seconds}${nanoseconds}`;
            const error = new Error();

            mockProcess.expects('on')
                .withArgs('message', sinon.match.func)
                .once();

            mockProcess.expects('on')
                .withArgs('error', sinon.match.func)
                .once()
                .callsArgWith(1, error);

            mockProcess.expects('send')
                .once()
                .withArgs({ requestId });

            mockProcess.expects('removeListener')
                .withArgs('message', sinon.match.func)
                .onFirstCall();

            mockProcess.expects('removeListener')
                .withArgs('error', sinon.match.func)
                .onSecondCall();

            sinon.stub(process, 'hrtime')
                .returns([seconds, nanoseconds]);

            await worker.run({})
                .catch(e => {
                    expect(e).to.equal(error);
                    mockProcess.verify();
                });
        });
    });
});
