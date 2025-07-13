// Spread Operator in TypeScript/JavaScript
// A comprehensive guide with real-world examples

// 1. DEFINITION & PURPOSE
// The spread operator (...) allows an iterable (array/object/string) 
// to be expanded into individual elements.
// It helps write more concise and readable code.

// 2. ARRAY OPERATIONS

// 2.1 Copying Arrays
// Without spread
const originalArray = [1, 2, 3];
const copyWithoutSpread = originalArray.slice();

// With spread - cleaner and more intuitive
const copyWithSpread = [...originalArray];

// 2.2 Merging Arrays
// Without spread
const arr1 = [1, 2];
const arr2 = [3, 4];
const mergedWithoutSpread = arr1.concat(arr2);

// With spread - more readable
const mergedWithSpread = [...arr1, ...arr2];

// Real example from our codebase (src/components/tasks/TimeSpent.tsx):
const sortedTasks = [...tasks]
  .filter(task => !task.hideFromPomodoro)
  .sort((a, b) => a.order - b.order);

// 3. OBJECT OPERATIONS

// 3.1 Copying Objects
// Without spread
const user = { name: 'John', age: 30 };
const userCopyWithoutSpread = Object.assign({}, user);

// With spread - cleaner syntax
const userCopyWithSpread = { ...user };

// 3.2 Merging Objects
// Without spread
const baseConfig = { api: 'v1', timeout: 3000 };
const customConfig = { timeout: 5000, retry: true };
const mergedConfigWithoutSpread = Object.assign({}, baseConfig, customConfig);

// With spread - more intuitive
const mergedConfigWithSpread = { ...baseConfig, ...customConfig };

// Real example from our codebase (src/components/RAGConfigPanel.tsx):
const handleConfigChange = <K extends keyof RAGConfigState>(
  key: K,
  value: RAGConfigState[K]
) => {
  const newConfig = { ...config, [key]: value };
  setConfig(newConfig);
  updateRAGConfig(newConfig);
};

// 4. FUNCTION ARGUMENTS

// 4.1 Rest Parameters
// Without spread
function sumWithoutSpread() {
  return Array.from(arguments).reduce((sum, num) => sum + num, 0);
}

// With spread - type-safe and clearer
function sumWithSpread(...numbers: number[]) {
  return numbers.reduce((sum, num) => sum + num, 0);
}

// 4.2 Passing Arguments
// Without spread
const numbers = [1, 2, 3];
const maxWithoutSpread = Math.max.apply(null, numbers);

// With spread - cleaner syntax
const maxWithSpread = Math.max(...numbers);

// 5. REACT COMPONENT PROPS
// Real example from our codebase:
interface Props {
  data: any;
  loading?: boolean;
  error?: string;
}

// Without spread
const ChildComponent: React.FC<Props> = (props) => {
  const data = props.data;
  const loading = props.loading;
  const error = props.error;
  return <div>{/* Component logic */}</div>;
};

// With spread - cleaner prop passing
const ChildComponent: React.FC<Props> = ({ ...props }) => {
  return <div>{/* Component logic */}</div>;
};

// Parent component usage
const ParentComponent: React.FC = () => {
  const commonProps = {
    data: { /* some data */ },
    loading: false
  };
  
  return (
    <ChildComponent {...commonProps} error="Some error" />
  );
};




















//EXERCISE

