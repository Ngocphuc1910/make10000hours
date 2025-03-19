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
- Supabase account (for authentication and database features)

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/make10000hours.git
cd make10000hours
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Configure Supabase
   - Create a Supabase project at [Supabase Dashboard](https://supabase.com/dashboard)
   - Go to Settings > API in your Supabase project
   - Copy the URL and anon key
   - Use our setup script to configure your environment:
   ```bash
   node setup-env.js
   ```
   - Follow the prompts to enter your Supabase URL and anon key
   - Alternatively, create a `.env` file manually with the following content:
   ```
   REACT_APP_SUPABASE_URL=your_supabase_url
   REACT_APP_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Start the development server
```bash
npm start
# or
yarn start
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Authentication Troubleshooting

If you experience issues with authentication:

1. Check the browser console for Supabase connection errors
2. Verify your environment variables are set correctly
3. Make sure your Supabase project has Email/Password authentication enabled
4. If you see placeholder errors, run the setup script again to update your credentials

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
