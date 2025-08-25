export const debugCalendar = {
  log: process.env.NODE_ENV === 'development' ? console.log : () => {},
  batch: (operation: string, count: number) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 ${operation}: ${count} items`);
    }
  }
};