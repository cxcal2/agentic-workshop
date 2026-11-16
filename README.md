# Building Agentic Workflows on AWS

This workshop is designed for builders ready to create Agentic Workflows on AWS. Agentic Workflows enable large language models (LLMs) to act autonomously, performing tasks or providing assistance on behalf of users.

In this workshop, you'll learn to:

1. Leverage capabilities in Amazon Bedrock to create both chatbot and non-chatbot workflows
2. Incorporate features such as code interpreter, guardrails, knowledge bases and more!
3. Use [Kiro](https://kiro.dev/) to assist in coding and debugging

![Gen AI Stack](gen_ai_stack.png)

### Workshop Modules

You will complete the following 3 modules:

1. **Build an Agentic Chatbot:** Create a Chatbot that can plan, use tools, and reflect to help with tasks.
2. **Build an Agentic Workflow:** Develop agentic workflows that don't rely on a chat interface.
3. **Using 3rd Party Agentic Workflows:** Use Amazon Bedrock with popular frameworks such as LangChain, LlamaIndex, and crewAI.

## Metro Tax Scan (Georgia unpaid property taxes)

This repository also contains **Metro Tax Scan** under [`metro-tax-scan/`](metro-tax-scan/) — a Next.js app that scans public Georgia county tax-sale / delinquent listings.

**Run it locally:** see the full step-by-step guide in [`metro-tax-scan/README.md`](metro-tax-scan/README.md) (prerequisites, install, `npm run dev`, first scan, smoke tests, APIs, and troubleshooting).

Quick start:

```bash
cd metro-tax-scan
npm install
env -u DATABASE_URL npm run dev
# open http://localhost:3000
```

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

