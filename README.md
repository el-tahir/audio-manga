# Detective Conan OST Manga Reader

A web application that enhances the Detective Conan manga reading experience with dynamic soundtrack playback. As you read through chapters, the application plays OST selections that match the mood of each page, determined by AI analysis.

## ✨ Features

- **🎵 Dynamic OST Playback** - Read with music that matches each page's atmosphere
- **🤖 AI-Powered Mood Classification** - Google Gemini AI analyzes pages for mood detection
- **📚 Chapter Management** - Easy chapter processing and organization
- **✏️ Mood Editor** - Fine-tune AI classifications with manual adjustments
- **📱 Responsive Reading Interface** - Clean, modern UI with navigation controls

## 🛠️ Technology Stack

**Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS  
**Backend:** Supabase (PostgreSQL), Google Cloud Storage  
**AI:** Google Gemini for image classification  
**Infrastructure:** Google Cloud Run, Cloud Tasks, Cloud Build  
**Development:** ESLint, Prettier, Husky

## 🚀 Quick Start

```bash
# Clone and install
git clone <repository-url>
cd audio-manga
npm install

# Set up environment (see docs/SETUP.md for details)
cp .env.example .env.local
# Edit .env.local with your configuration

# Run development server
npm run dev
```

## 📖 Documentation

- **[Setup Guide](docs/SETUP.md)** - Detailed installation and configuration
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Google Cloud Run deployment
- **[API Documentation](docs/API.md)** - REST API reference

## 🎯 Usage

1. **Add Chapter** - Navigate to the manga classifier page to download and process new chapters
2. **Read** - Access processed chapters through the reader interface  
3. **Adjust Moods** - Use the mood editor to fine-tune AI classifications
4. **Listen** - Enjoy dynamic OST playback as you read

## 🔧 Development

```bash
# Development commands
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

This project is for educational and personal use. Please respect manga publishers' rights and use legally obtained content.
