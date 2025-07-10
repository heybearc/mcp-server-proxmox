# Contributing to MCP Server Proxmox

Thank you for your interest in contributing to the MCP Server for Proxmox VE! This document provides guidelines for contributing to this project and information about contributing to the broader MCP ecosystem.

## 🚀 Quick Start

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/mcp-server-proxmox.git`
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/your-feature-name`
5. Make your changes and test them
6. Submit a pull request

## 🧪 Development Setup

### Prerequisites
- Node.js 18.0.0 or higher
- Access to a Proxmox VE environment for testing
- Git

### Local Development
```bash
# Install dependencies
npm install

# Run in development mode with auto-reload
npm run dev

# Build the project
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## 📝 Code Style

- Use TypeScript for all new code
- Follow the existing code style (enforced by ESLint and Prettier)
- Write meaningful commit messages
- Add JSDoc comments for public APIs
- Include tests for new features

## 🧪 Testing

- Write unit tests for new functions
- Test with real Proxmox environments when possible
- Ensure all existing tests pass before submitting PR

## 📋 Pull Request Process

1. Update documentation if needed
2. Add tests for new functionality
3. Ensure all tests pass
4. Update CHANGELOG.md if applicable
5. Submit PR with clear description of changes

## 🐛 Bug Reports

When reporting bugs, please include:
- Proxmox VE version
- Node.js version
- Steps to reproduce
- Expected vs actual behavior
- Error messages/logs

## 💡 Feature Requests

- Check existing issues first
- Describe the use case clearly
- Explain why it would be valuable
- Consider implementation complexity

---

# Contributing to the MCP Ecosystem

## 🌟 About the Model Context Protocol (MCP)

The Model Context Protocol is an open standard that enables AI assistants to securely connect to external data sources and tools. It's developed by Anthropic and the broader AI community.

### Key MCP Repositories

#### Official MCP Organization
- **Main Repository**: https://github.com/modelcontextprotocol/specification
- **TypeScript SDK**: https://github.com/modelcontextprotocol/typescript-sdk
- **Python SDK**: https://github.com/modelcontextprotocol/python-sdk
- **Reference Servers**: https://github.com/modelcontextprotocol/servers

#### Language-Specific SDKs
- **C# SDK**: https://github.com/modelcontextprotocol/csharp-sdk
- **Java SDK**: https://github.com/modelcontextprotocol/java-sdk
- **Kotlin SDK**: https://github.com/modelcontextprotocol/kotlin-sdk

## 🤝 How to Contribute to MCP

### 1. Contributing to MCP Specification
The core MCP specification defines the protocol itself:
- **Repository**: https://github.com/modelcontextprotocol/specification
- **Focus**: Protocol design, message formats, capabilities
- **Skills Needed**: Protocol design, JSON Schema, documentation

### 2. Contributing to SDKs
Each SDK implements MCP in different programming languages:
- **TypeScript**: Most mature, used by many servers
- **Python**: Growing ecosystem, great for data science tools
- **Java/Kotlin**: Enterprise and Android applications
- **C#**: .NET ecosystem integration

### 3. Contributing Reference Servers
The servers repository contains example implementations:
- **Repository**: https://github.com/modelcontextprotocol/servers
- **Examples**: File system, Git, database, API integrations
- **Purpose**: Demonstrate MCP capabilities and best practices

### 4. Creating New MCP Servers
Like this Proxmox server! Popular categories include:
- **Infrastructure**: Docker, Kubernetes, cloud providers
- **Development**: IDEs, CI/CD, code repositories
- **Data**: Databases, APIs, file systems
- **Communication**: Slack, Discord, email
- **Productivity**: Calendar, task management, note-taking

## 📋 MCP Contribution Guidelines

### General Principles
1. **Security First**: Always validate inputs and handle credentials securely
2. **Clear Documentation**: Comprehensive README and API documentation
3. **Error Handling**: Graceful error handling with meaningful messages
4. **Testing**: Unit tests and integration tests where possible
5. **Standards Compliance**: Follow MCP specification exactly

### Code Quality Standards
- Use official MCP SDKs when available
- Follow language-specific best practices
- Include comprehensive error handling
- Provide clear logging and debugging information
- Support configuration via environment variables

### Documentation Requirements
- Clear installation instructions
- Configuration examples
- Usage examples with AI assistants
- API reference for all tools
- Security considerations

## 🏗️ MCP Server Architecture Best Practices

### 1. Tool Design
```typescript
// Good: Clear, specific tool names
"get_vm_status", "start_vm", "list_containers"

// Avoid: Generic or ambiguous names
"get_info", "do_action", "manage"
```

### 2. Error Handling
```typescript
// Always provide meaningful error messages
throw new McpError(
  ErrorCode.InvalidParams,
  `VM ${vmid} not found on node ${node}`
);
```

### 3. Input Validation
```typescript
// Validate all inputs
if (!node || !vmid) {
  throw new Error('Node and VMID are required');
}
```

### 4. Configuration
```typescript
// Use environment variables for configuration
const config = {
  host: process.env.PROXMOX_HOST || 'localhost',
  port: parseInt(process.env.PROXMOX_PORT || '8006'),
  // ...
};
```

## 🌍 MCP Community

### Getting Involved
- **Discord**: Join the MCP community Discord
- **GitHub Discussions**: Participate in discussions on MCP repositories
- **Issues**: Help triage and fix issues
- **Documentation**: Improve documentation and examples

### Sharing Your MCP Server
1. **Publish to NPM**: Make it easy to install
2. **Add to MCP Registry**: Submit to community server lists
3. **Write Blog Posts**: Share your experience and use cases
4. **Present at Conferences**: Speak about MCP and your implementations

## 📚 Resources

### Official Documentation
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP Documentation](https://modelcontextprotocol.io/docs)
- [TypeScript SDK Docs](https://github.com/modelcontextprotocol/typescript-sdk)

### Community Resources
- [MCP Server Examples](https://github.com/modelcontextprotocol/servers)
- [Community Server Registry](https://github.com/modelcontextprotocol/servers/blob/main/README.md)
- [Best Practices Guide](https://modelcontextprotocol.io/docs/best-practices)

### Development Tools
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector) - Debug MCP servers
- [MCP Client Libraries](https://modelcontextprotocol.io/docs/tools/clients) - Test your servers

---

## 🎯 Next Steps

1. **Start Small**: Begin with simple contributions like documentation fixes
2. **Learn the Protocol**: Understand MCP specification thoroughly
3. **Build Something Useful**: Create servers for tools you use daily
4. **Share Knowledge**: Write about your experience and help others
5. **Join the Community**: Engage with other MCP developers

The MCP ecosystem is growing rapidly, and there are many opportunities to contribute meaningful tools and improvements. Whether you're fixing bugs, adding features, or creating entirely new servers, your contributions help make AI assistants more powerful and useful for everyone.

Happy coding! 🚀
