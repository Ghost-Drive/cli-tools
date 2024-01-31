const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');

const execAsync = util.promisify(exec);

// Helper function to run command line commands
async function runCommand(command) {
    try {
        const { stdout, stderr } = await execAsync(command);
        return { stdout, stderr };
    } catch (error) {
        return { error };
    }
}

const oAuthToken = 'MDhjOTM4OWQxYjg4MjAyZGQ3YWEyZjliNWE5NmZlYzhiNDA2MjQzNGY5MzAwNDExZDU2MDM1OTAwMGYzMmFlYQ';
const workspaceName = 'testWorkspaceNew';
describe('Other', () => {
    // Test for 'create-workspace <name>'
    // test('create-workspace', async () => {
    //
    //     const { stdout, stderr, error } = await runCommand(`./cli.ts create-workspace ${workspaceName} --oAuthToken ${oAuthToken}`);
    //     console.log(stdout, stderr, error);
    //
    //     expect(error).toBeUndefined();
    //     // expect(stderr).toBeFalsy();
    //     expect(stdout).toContain('Workspace created');
    // });

    // Test for 'list-workspaces'
    // test('list-workspaces', async () => {
    //     const { stdout, stderr, error } = await runCommand(`./cli.ts list-workspaces`);
    //     expect(error).toBeUndefined();
    //     expect(stderr).toBeFalsy();
    // });

});


describe('File workflow', () => {

    // Test for 'cp <from> <to>' - upload
    test('cp upload', async () => {

        const sourceFile = 'source.txt';
        const destinationFile = 'destination.txt';
        fs.writeFileSync(sourceFile, 'Test content'); // Create a source file
        const cmd = `cp ${sourceFile} gd://${workspaceName}/${destinationFile}`;
        console.log({cmd});
        const { stdout, stderr, error } = await runCommand(cmd);

        // @todo Check if the destination file exists

        fs.unlinkSync(sourceFile); // Clean up

    });

    // Test for 'cp <from> <to>' - upload
    // test('cp download', async () => {
    //     const sourceFile = 'source.txt';
    //     const destinationFile = 'destination.txt';
    //     fs.writeFileSync(sourceFile, 'Test content'); // Create a source file
    //     await runCommand(`cp ${sourceFile} ${destinationFile}`);
    //     expect(fs.existsSync(destinationFile)).toBeTruthy(); // Check if the destination file exists
    //     fs.unlinkSync(sourceFile); // Clean up
    //     fs.unlinkSync(destinationFile);
    // });
    //
    // // Test for 'ls <folderPath>'
    // test('ls', async () => {
    //     const folderPath = '.';
    //     const { stdout, stderr, error } = await runCommand(`ls ${folderPath}`);
    //     expect(error).toBeUndefined();
    //     expect(stderr).toBeFalsy();
    //     expect(stdout).toBeTruthy(); // Check if there is any output
    // });
    //
    // // Test for 'rm <folderPath>'
    // test('rm', async () => {
    //     const folderPath = 'testFolder';
    //     fs.mkdirSync(folderPath); // Create a folder to delete
    //     await runCommand(`rm ${folderPath}`);
    //     expect(fs.existsSync(folderPath)).toBeFalsy(); // Check if the folder is deleted
    // });

});
