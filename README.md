# make10000hours Pomodoro Timer

A modern Pomodoro timer application built with React and Tailwind CSS, featuring task management, authentication, and customizable timer settings.

## Features

- **Pomodoro Timer
  - Customizable Pomodoro, short break, and long break durations
  - Visual timer with circular progress indicator
  - Audio notifications when timers end

- **Task Management**:
  - Add, edit, and delete tasks
  - Mark tasks as completed
  - Task data synced with Firebase for logged-in users
  - Local storage backup for non-authenticated users

- **User Authentication**:
  - Email/password registration and login
  - Google sign-in integration
  - User profile management

- **Customization**:
  - Upload custom background images
  - Configure timer settings
  - Integrated Spotify player (optional)

## Technology Stack

- React with Hooks and Context API
- Tailwind CSS for styling
- Firebase Authentication
- Firestore Database
- Modern UI components inspired by shadcn/ui

## Getting Started

### Prerequisites

- Node.js (v14 or later recommended)
- NPM or Yarn
- Firebase account (for authentication and database features)

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/make10000hours.git
cd make10000hours/pomodoro-react
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Configure Firebase
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Authentication (Email/Password and Google Sign-in)
   - Create a Firestore database
   - Update the Firebase configuration in `src/firebase/firebase.js` with your project credentials

4. Start the development server
```bash
npm start
# or
yarn start
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Future Enhancements

This app is part of the make10000hours project, which will be expanded to include:

- Projects management for tracking progress toward 10,000 hours
- Advanced analytics and reporting
- Kanban board for task management
- Gamification features
- Distraction blocking
- Social features

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- The Pomodoro Technique® is a registered trademark of Francesco Cirillo
- UI components inspired by shadcn/ui
- Tailwind CSS for the styling system 
