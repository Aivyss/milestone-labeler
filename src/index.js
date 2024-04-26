const core = require("@actions/core")
const github = require("@actions/github")
const {Octokit} = require("@octokit/rest")

async function run() {
    console.log("[milestone-labeler] start process");

    // context & APIs
    const githubToken = core.getInput('github_token');
    const label = core.getInput('label');
    let page = parseInt(core.getInput('page'), 10);
    const perPage = parseInt(core.getInput('per_page'), 10);
    const octokit = new Octokit({
        auth: githubToken,
    });
    const context = github.context;

    // Get PR information
    console.log("[milestone-labeler] get milestone number")
    const prNumber = context.payload.pull_request?.number || -1;
    const {data} = await octokit.rest.pulls.get({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: prNumber,
    })
    const milestoneNumber = data?.milestone?.number;
    console.log("[milestone-labeler] milestone number =", milestoneNumber)
    if (milestoneNumber === null || milestoneNumber === undefined) {
        throw "[milestone-labeler] no milestone pull request"
    }

    // Get valid PRs
    console.log("[milestone-labeler] filter valid pull requests")
    const pullRequests = []
    while (true) {
        const {data} = await octokit.rest.pulls.list({
            owner: context.repo.owner,
            repo: context.repo.repo,
            state: 'closed',
            sort: 'updated',
            per_page: perPage,
            page: page,
        })
        if (data.length < 1) {
            // filtering is done.
            break
        }

        for (let i = 0; i <data.length; i += 1) {
            const pr = data[i];
            if (pr.milestone === undefined || pr.milestone === null) {
                continue
            }

            if (pr.milestone.number == milestoneNumber) {
                pullRequests.push(pr)
            }
        }

        page += 1
    }

    // Attach label
    for (let i = 0; i < pullRequests.length; i += 1) {
        const prNumber = pullRequests[i].number;
        if (prNumber === undefined || prNumber === null) {
            continue
        }

        console.log(`[milestone-labeler] attach label to pr: ${prNumber}`);
        await octokit.rest.issues.addLabels({
            owner: context.repo.owner,
            repo: context.repo.repo,
            issue_number: prNumber,
            labels: [label],
        });
    }

    console.log("[milestone-labeler] all done")
}

run().then(_ => _).catch(e => console.error(e))