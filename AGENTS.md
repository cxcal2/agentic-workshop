# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is an AWS workshop codebase ("Building Agentic Workflows on AWS") containing standalone Python modules that demonstrate AI agent workflows using Amazon Bedrock. It is **not** a traditional monolithic application — each directory is an independent module with its own entry point.

### AWS Credentials (Required)

Every module calls AWS APIs (primarily Amazon Bedrock). Without configured AWS credentials (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` or `~/.aws/credentials`), no module can run end-to-end. The default region is `us-west-2`.

### Project Structure

| Directory | Entry Point | How to Run |
|-----------|------------|-----------|
| `agentic_chatbot/` | `chatbot_st.py` | `streamlit run chatbot_st.py` (from that dir) |
| `agentic_workflow/` | `agentic_tools.py` | `python3 agentic_tools.py` |
| `3rd_party/` | Individual scripts | `python3 langchain_agentic.py`, etc. |
| `claude_agent/` | `example_claude.py`, `example_mcp.py` | `python3 <script>.py` |
| `strands_agents/` | Individual scripts | `python3 weather_word_count.py`, etc. |
| `prod_agent/` | `cdk_agent_core.py` | `python3 cdk_agent_core.py` |
| `reinvent_2024_agentic/` | `agent_chatbot_st.py` | `streamlit run agent_chatbot_st.py` |
| `sagemaker_ai/` | `bedrock_example.py` | `python3 bedrock_example.py` |

### Dependencies

Multiple `requirements*.txt` at root level, plus per-module ones:
- `requirements.txt` — core deps (streamlit, boto3, strands-agents, etc.)
- `requirements_langchain.txt` — LangChain track
- `requirements_llama_index.txt` — LlamaIndex track
- `requirements_crewai.txt` — CrewAI track
- `requirements_smolagents.txt` — Smolagents track
- `claude_agent/requirements.txt` — Claude Agent SDK
- `prod_agent/requirements.txt` — AgentCore production agent

Install all with: `pip install -r requirements.txt -r requirements_langchain.txt -r requirements_llama_index.txt -r requirements_crewai.txt -r requirements_smolagents.txt -r claude_agent/requirements.txt -r prod_agent/requirements.txt`

### Gotchas

- There is no linter, formatter, test suite, or CI pipeline configured in this repo.
- The `agentic_chatbot/agent_tools.py` contains a placeholder `AGENT_ID = "REPLACE_WITH_YOUR_AGENT_ID"` that must be replaced with a real Bedrock Agent ID before the chatbot can actually process queries.
- `aiobotocore` has a strict `botocore` version pin; installing `claude_agent/requirements.txt` upgrades `botocore` beyond what `aiobotocore` supports. This causes a pip warning but does not affect runtime for most modules (only `llama_index` async Bedrock calls may be affected).
- The `RequestsDependencyWarning` about urllib3/chardet version mismatch is benign and can be ignored.
- Streamlit apps must be run from their respective directories (they import sibling modules with relative names like `import agent_tools`).
