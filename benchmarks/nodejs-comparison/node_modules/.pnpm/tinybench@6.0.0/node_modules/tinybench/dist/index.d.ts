//#region src/task.d.ts
/**
 * A class that represents each benchmark task in Tinybench. It keeps track of the
 * results, name, the task function, the number times the task function has been executed, ...
 */
declare class Task extends EventTarget {
  #private;
  addEventListener: <K extends TaskEvents>(type: K, listener: EventListener<K, 'task'> | EventListenerObject<K, 'task'> | null, options?: AddEventListenerOptionsArgument) => void;
  removeEventListener: <K extends TaskEvents>(type: K, listener: EventListener<K, 'task'> | EventListenerObject<K, 'task'> | null, options?: RemoveEventListenerOptionsArgument) => void;
  /**
   * The name of the task.
   * @returns The task name as a string
   */
  get name(): string;
  /**
   * The result of the task.
   * @returns The task result including state, statistics, and runtime information
   */
  get result(): TaskResult & TaskResultRuntimeInfo & TaskResultTimestampProviderInfo;
  /**
   * The number of times the task function has been executed.
   * @returns The total number of executions performed
   */
  get runs(): number;
  constructor(bench: BenchLike, name: string, fn: Fn, fnOpts?: FnOptions);
  /**
   * Resets the task to make the `Task.runs` a zero-value and remove the `Task.result` object property.
   * @param emit - whether to emit the `reset` event or not
   */
  reset(emit?: boolean): void;
  /**
   * Runs the current task and writes the results in `Task.result` object property.
   * @returns the current task
   */
  run(): Promise<Task>;
  /**
   * Runs the current task synchronously and writes the results in `Task.result` object property.
   * @returns the current task
   */
  runSync(): this;
  /**
   * Warms up the current task.
   */
  warmup(): Promise<void>;
  /**
   * Warms up the current task synchronously.
   */
  warmupSync(): void;
}
//#endregion
//#region src/event.d.ts
/**
 * The BenchEvent class represents events that occur during the benchmarking
 * process.
 */
declare class BenchEvent<K extends BenchEvents = BenchEvents, M extends 'bench' | 'task' = 'bench'> extends globalThis.Event {
  #private;
  type: K;
  /**
   * The error associated with the event.
   * @returns The error if the event type is one that includes an error; otherwise, undefined
   */
  get error(): K extends BenchEventsWithError ? Error : undefined;
  /**
   * The task associated with the event.
   * @returns The task if the event type is one that includes a task; otherwise, undefined
   */
  get task(): M extends 'task' ? Task : K extends BenchEventsWithTask ? Task : undefined;
  constructor(type: BenchEventsWithError, task: Task, error: Error);
  constructor(type: BenchEventsWithTask, task: Task);
  constructor(type: BenchEventsOptionalTask, task?: Task);
}
//#endregion
//#region src/types.d.ts
/**
 * Options for adding an event listener
 */
type AddEventListenerOptionsArgument = Parameters<typeof EventTarget.prototype.addEventListener>[2];
/**
 * Bench events
 */
type BenchEvents = 'abort' | 'add' | 'complete' | 'cycle' | 'error' | 'remove' | 'reset' | 'start' | 'warmup';
/**
 * Bench events that may have an associated Task
 */
type BenchEventsOptionalTask = Omit<BenchEvents, 'add' | 'cycle' | 'error' | 'remove'>;
/**
 * Bench events that have an associated error
 */
type BenchEventsWithError = Extract<BenchEvents, 'error'>;
/**
 * Bench events that have an associated Task
 */
type BenchEventsWithTask = Extract<BenchEvents, 'add' | 'cycle' | 'error' | 'remove'>;
/**
 * Used to decouple Bench and Task
 */
interface BenchLike extends EventTarget {
  /**
   * Adds a listener for the specified event type.
   */
  addEventListener: <K extends BenchEvents>(type: K, listener: EventListener<K> | EventListenerObject<K> | null, options?: AddEventListenerOptionsArgument) => void;
  /**
   * Executes tasks concurrently based on the specified concurrency mode, if set.
   *
   * - When `mode` is set to `null` (default), concurrency is disabled.
   * - When `mode` is set to 'task', each task's iterations (calls of a task function) run concurrently.
   * - When `mode` is set to 'bench', different tasks within the bench run concurrently.
   */
  concurrency: Concurrency;
  /**
   * The amount of executions per task.
   */
  iterations: number;
  /**
   * A function to get a timestamp.
   */
  now: NowFn;
  /**
   * Removes a previously registered event listener.
   */
  removeEventListener: <K extends BenchEvents>(type: K, listener: EventListener<K> | EventListenerObject<K> | null, options?: RemoveEventListenerOptionsArgument) => void;
  /**
   * Should samples be retained for further custom processing
   */
  retainSamples: boolean;
  /**
   * The JavaScript runtime environment.
   */
  runtime: JSRuntime;
  /**
   * The JavaScript runtime version.
   */
  runtimeVersion: string;
  /**
   * A setup function that runs before each task execution.
   */
  setup: (task: Task, mode: 'run' | 'warmup') => Promise<void> | void;
  /**
   * An AbortSignal to cancel the benchmark
   */
  signal?: AbortSignal;
  /**
   * A teardown function that runs after each task execution.
   */
  teardown: (task: Task, mode: 'run' | 'warmup') => Promise<void> | void;
  /**
   * The maximum number of concurrent tasks to run
   */
  threshold: number;
  /**
   * Whether to throw an error if a task function throws
   */
  throws: boolean;
  /**
   * The amount of time to run each task.
   */
  time: number;
  /**
   * The timestamp provider used by the benchmark.
   */
  timestampProvider: TimestampProvider;
  /**
   * Whether to warmup the tasks before running them
   */
  warmup: boolean;
  /**
   * The amount of warmup iterations per task.
   */
  warmupIterations: number;
  /**
   * The amount of time to warmup each task.
   */
  warmupTime: number;
}
/**
 * Bench options
 */
interface BenchOptions {
  /**
   * Executes tasks concurrently based on the specified concurrency mode.
   *
   * - When `mode` is set to `null` (default), concurrency is disabled.
   * - When `mode` is set to 'task', each task's iterations (calls of a task function) run concurrently.
   * - When `mode` is set to 'bench', different tasks within the bench run concurrently.
   */
  concurrency?: Concurrency;
  /**
   * The number of times that a task should run if even the time option is finished.
   * @default 64
   */
  iterations?: number;
  /**
   * Benchmark name.
   */
  name?: string;
  /**
   * Function to get the current timestamp in milliseconds.
   */
  now?: NowFn;
  /**
   * Keep samples for statistics calculation
   * @default false
   */
  retainSamples?: boolean;
  /**
   * Setup function to run before each benchmark task (cycle)
   */
  setup?: Hook;
  /**
   * An AbortSignal for aborting the benchmark.
   */
  signal?: AbortSignal;
  /**
   * Teardown function to run after each benchmark task (cycle).
   */
  teardown?: Hook;
  /**
   * The maximum number of concurrent tasks to run
   * @default Number.POSITIVE_INFINITY
   */
  threshold?: number;
  /**
   * Throws if a task fails.
   * @default false
   */
  throws?: boolean;
  /**
   * Time needed for running a benchmark task in milliseconds.
   * @default 1000
   */
  time?: number;
  /**
   * The timestamp provider used by the benchmark. By default 'performance.now'
   * will be used.
   */
  timestampProvider?: TimestampFns | TimestampProvider;
  /**
   * Warmup benchmark.
   * @default true
   */
  warmup?: boolean;
  /**
   * Warmup iterations.
   * @default 16
   */
  warmupIterations?: number;
  /**
   * Warmup time in milliseconds.
   * @default 250
   */
  warmupTime?: number;
}
/**
 * - When `mode` is set to `null` (default), concurrency is disabled.
 * - When `mode` is set to 'task', each task's iterations (calls of a task function) run concurrently.
 * - When `mode` is set to 'bench', different tasks within the bench run concurrently.
 */
type Concurrency = 'bench' | 'task' | null;
/**
 * Converts a Task to a console.table friendly object
 */
type ConsoleTableConverter = (task: Task) => Record<string, number | string>;
/**
 * Event listener
 */
type EventListener<E extends BenchEvents, M extends 'bench' | 'task' = 'bench'> = (evt: BenchEvent<E, M>) => void;
/**
 * Both the `Task` and `Bench` objects extend the `EventTarget` object.
 * So you can attach a listeners to different types of events to each class instance
 * using the universal `addEventListener` and `removeEventListener` methods.
 */
interface EventListenerObject<E extends BenchEvents, M extends 'bench' | 'task' = 'bench'> {
  /**
   * A method called when the event is dispatched.
   */
  handleEvent(evt: BenchEvent<E, M>): void;
}
/**
 * The task function.
 *
 * If you need to provide a custom duration for the task (e.g.: because
 * you want to measure a specific part of its execution), you can return an
 * object with a `overriddenDuration` field. You should still use
 * `bench.opts.now()` to measure that duration.
 */
type Fn = () => FnReturnedObject | Promise<FnReturnedObject | unknown> | unknown;
/**
 * The task hook function signature.
 * If warmup is enabled, the hook will be called twice, once for the warmup and once for the run.
 * @param mode the mode where the hook is being called
 */
type FnHook = (this: Task, mode?: 'run' | 'warmup') => Promise<void> | void;
/**
 * The task function options
 */
interface FnOptions {
  /**
   * An optional function that is run after all iterations of this task end
   */
  afterAll?: FnHook;
  /**
   * An optional function that is run after each iteration of this task
   */
  afterEach?: FnHook;
  /**
   * Whether the provided task function is asynchronous, otherwise it is
   * determined automatically.
   */
  async?: boolean;
  /**
   * An optional function that is run before iterations of this task begin
   */
  beforeAll?: FnHook;
  /**
   * An optional function that is run before each iteration of this task
   */
  beforeEach?: FnHook;
  /**
   * Retain samples for this task, overriding the bench-level retainSamples option
   */
  retainSamples?: boolean;
  /**
   * An AbortSignal for aborting this specific task
   *
   * If not provided, falls back to {@link BenchOptions.signal}
   */
  signal?: AbortSignal;
}
/**
 * A possible object returned by task functions to override default behaviors,
 * like the duration of the function itself.
 */
interface FnReturnedObject {
  /**
   * An overridden duration for the task function, to be used instead of the
   * duration measured by tinybench when running the benchmark.
   *
   * This can be useful to measure parts of the execution of a function that are
   * hard to execute independently.
   */
  overriddenDuration?: number;
}
/**
 * The hook function signature.
 * If warmup is enabled, the hook will be called twice, once for the warmup and once for the run.
 * @param task the task instance
 * @param mode the mode where the hook is being called
 */
type Hook = (task?: Task, mode?: 'run' | 'warmup') => Promise<void> | void;
/**
 * The JavaScript runtime environment.
 * @see https://runtime-keys.proposal.wintercg.org/
 */
type JSRuntime = 'browser' | 'bun' | 'deno' | 'edge-light' | 'fastly' | 'hermes' | 'jsc' | 'lagon' | 'moddable' | 'netlify' | 'node' | 'quickjs-ng' | 'spidermonkey' | 'unknown' | 'v8' | 'workerd';
/**
/**
 * A function that returns the current timestamp.
 */
type NowFn = () => number;
type RemoveEventListenerOptionsArgument = Parameters<typeof EventTarget.prototype.removeEventListener>[2];
/**
 * The resolved benchmark options
 */
interface ResolvedBenchOptions extends BenchOptions {
  iterations: NonNullable<BenchOptions['iterations']>;
  now: NonNullable<BenchOptions['now']>;
  setup: NonNullable<BenchOptions['setup']>;
  teardown: NonNullable<BenchOptions['teardown']>;
  throws: NonNullable<BenchOptions['throws']>;
  time: NonNullable<BenchOptions['time']>;
  warmup: NonNullable<BenchOptions['warmup']>;
  warmupIterations: NonNullable<BenchOptions['warmupIterations']>;
  warmupTime: NonNullable<BenchOptions['warmupTime']>;
}
/**
 * A type representing a samples-array with at least one number.
 */
type Samples = [number, ...number[]];
/**
 * A type representing a sorted samples-array with at least one number.
 */
type SortedSamples = Samples & {
  /**
   * A unique symbol to identify sorted samples
   */
  readonly __sorted__: unique symbol;
};
/**
 * The statistics object
 */
interface Statistics {
  /**
   * mean/average absolute deviation
   */
  aad: number;
  /**
   * critical value
   */
  critical: number;
  /**
   * degrees of freedom
   */
  df: number;
  /**
   * median absolute deviation
   */
  mad: number;
  /**
   * the maximum value
   */
  max: number;
  /**
   * mean/average
   */
  mean: number;
  /**
   * the minimum value
   */
  min: number;
  /**
   * margin of error
   */
  moe: number;
  /**
   * p50/median percentile
   */
  p50: number;
  /**
   * p75 percentile
   */
  p75: number;
  /**
   * p99 percentile
   */
  p99: number;
  /**
   * p995 percentile
   */
  p995: number;
  /**
   * p999 percentile
   */
  p999: number;
  /**
   * relative margin of error
   */
  rme: number;
  /**
   * samples used to calculate the statistics
   */
  samples: SortedSamples | undefined;
  /**
   * samples count
   */
  samplesCount: number;
  /**
   * standard deviation
   */
  sd: number;
  /**
   * standard error of the mean/average (a.k.a. the standard deviation of the distribution of the sample mean/average)
   */
  sem: number;
  /**
   * variance
   */
  variance: number;
}
/**
 * Task events
 */
type TaskEvents = Extract<BenchEvents, 'abort' | 'complete' | 'cycle' | 'error' | 'reset' | 'start' | 'warmup'>;
/**
 * The task result
 */
type TaskResult = TaskResultAborted | TaskResultAbortedWithStatistics | TaskResultCompleted | TaskResultErrored | TaskResultNotStarted | TaskResultStarted;
/**
 * The task result for aborted tasks.
 */
interface TaskResultAborted {
  /**
   * the task state
   */
  state: 'aborted';
}
/**
 * The task result for aborted tasks, having also statistical data.
 */
interface TaskResultAbortedWithStatistics extends TaskResultWithStatistics {
  /**
   * the task state
   */
  state: 'aborted-with-statistics';
}
/**
 * The task result for completed tasks with statistical data.
 */
interface TaskResultCompleted extends TaskResultWithStatistics {
  /**
   * how long each operation takes (ms)
   */
  period: number;
  /**
   * the task state
   */
  state: 'completed';
}
/**
 * The task result for errored tasks
 */
interface TaskResultErrored {
  /**
   * the error that caused the task to fail
   */
  error: Error;
  /**
   * the task state
   */
  state: 'errored';
}
/**
 * The task result for not started tasks
 */
interface TaskResultNotStarted {
  /**
   * the task state
   */
  state: 'not-started';
}
/**
 * The additional runtime information for task results
 */
interface TaskResultRuntimeInfo {
  /**
   * the JavaScript runtime environment
   */
  runtime: JSRuntime;
  /**
   * the JavaScript runtime version
   */
  runtimeVersion: string;
}
/**
 * The task result for started tasks
 */
interface TaskResultStarted {
  /**
   * the task state
   */
  state: 'started';
}
/**
 * The timestamp provider information for task results
 */
interface TaskResultTimestampProviderInfo {
  /**
   * the name of the timestamp provider used during the benchmark
   */
  timestampProviderName: (string & {}) | TimestampFns;
}
/**
 * The statistical data for task results
 */
interface TaskResultWithStatistics {
  /**
   * the task latency statistics
   */
  latency: Statistics;
  /**
   * how long each operation takes (ms)
   */
  period: number;
  /**
   * the task throughput statistics
   */
  throughput: Statistics;
  /**
   * the time to run the task benchmark cycle (ms)
   */
  totalTime: number;
}
/**
 * A timestamp function that returns either a number or bigint.
 */
type TimestampFn = () => TimestampValue;
/**
 * Possible timestamp provider names.
 * 'custom' is used when a custom timestamp function is provided.
 */
type TimestampFns = 'auto' | 'bunNanoseconds' | 'custom' | 'hrtimeNow' | 'performanceNow';
/**
 * A timestamp provider and its related functions.
 */
interface TimestampProvider {
  /**
   * The actual function of the timestamp provider.
   * @returns the timestamp value
   */
  fn: TimestampFn;
  /**
   * Converts milliseconds to the timestamp value.
   * @param value - the milliseconds value
   * @returns the timestamp value
   */
  fromMs: (value: number) => TimestampValue;
  /**
   * The name of the timestamp provider.
   */
  name: (string & {}) | TimestampFns;
  /**
   * Converts the timestamp value to milliseconds.
   * @param value - the timestamp value
   * @returns the milliseconds
   */
  toMs: (value: TimestampValue) => number;
}
/**
 * A timestamp value, either number or bigint. Internally timestamps can use
 * either representation depending on the environment and the chosen timestamp
 * function.
 */
type TimestampValue = bigint | number;
//#endregion
//#region src/bench.d.ts
/**
 * The Bench class keeps track of the benchmark tasks and controls them.
 */
declare class Bench extends EventTarget implements BenchLike {
  #private;
  addEventListener: <K extends BenchEvents>(type: K, listener: EventListener<K> | EventListenerObject<K> | null, options?: AddEventListenerOptionsArgument) => void;
  /**
   * Executes tasks concurrently based on the specified concurrency mode.
   *
   * - When `mode` is set to `null` (default), concurrency is disabled.
   * - When `mode` is set to 'task', each task's iterations (calls of a task function) run concurrently.
   * - When `mode` is set to 'bench', different tasks within the bench run concurrently.
   */
  readonly concurrency: 'bench' | 'task' | null;
  /**
   * The amount of executions per task.
   */
  readonly iterations: number;
  /**
   * The benchmark name.
   */
  readonly name: string | undefined;
  /**
   * A function to get a timestamp.
   */
  readonly now: () => number;
  /**
   * Removes a previously registered event listener.
   */
  removeEventListener: <K extends BenchEvents>(type: K, listener: EventListener<K> | EventListenerObject<K> | null, options?: RemoveEventListenerOptionsArgument) => void;
  readonly retainSamples: boolean;
  /**
   * The JavaScript runtime environment.
   */
  readonly runtime: JSRuntime;
  /**
   * The JavaScript runtime version.
   */
  readonly runtimeVersion: string;
  /**
   * A setup function that runs before each task execution.
   */
  readonly setup: (task: Task, mode: 'run' | 'warmup') => Promise<void> | void;
  /**
   * An AbortSignal to cancel the benchmark.
   */
  readonly signal: AbortSignal | undefined;
  /**
   * A teardown function that runs after each task execution.
   */
  readonly teardown: (task: Task, mode: 'run' | 'warmup') => Promise<void> | void;
  /**
   * The maximum number of concurrent tasks to run
   * @default Number.POSITIVE_INFINITY
   */
  readonly threshold: number;
  /**
   * Whether to throw an error if a task function throws
   * @default false
   */
  readonly throws: boolean;
  /**
   * The amount of time to run each task.
   */
  readonly time: number;
  /**
   * A timestamp provider and its related functions.
   */
  readonly timestampProvider: TimestampProvider;
  /**
   * Whether to warmup the tasks before running them
   */
  readonly warmup: boolean;
  /**
   * The amount of warmup iterations per task.
   */
  readonly warmupIterations: number;
  /**
   * The amount of time to warmup each task.
   */
  readonly warmupTime: number;
  /**
   * The tasks results as an array.
   * @returns the tasks results
   */
  get results(): Readonly<TaskResult>[];
  /**
   * The tasks as an array.
   * @returns An array containing all benchmark tasks
   */
  get tasks(): Task[];
  constructor(options?: BenchOptions);
  /**
   * Adds a benchmark task to the task map.
   * @param name - the task name
   * @param fn - the task function
   * @param fnOpts - the task function options
   * @returns the Bench instance
   * @throws {Error} when a task with the same name already exists
   */
  add(name: string, fn: Fn, fnOpts?: FnOptions): this;
  /**
   * Gets a task based on the task name.
   * @param name - the task name
   * @returns the Task instance or undefined if not found
   */
  getTask(name: string): Task | undefined;
  /**
   * Removes a benchmark task from the task map.
   * @param name - the task name
   * @returns the Bench instance
   */
  remove(name: string): this;
  /**
   * Resets all tasks and removes their results.
   */
  reset(): void;
  /**
   * Runs the added benchmark tasks.
   * @returns the tasks array
   */
  run(): Promise<Task[]>;
  /**
   * Runs the added benchmark tasks synchronously.
   * @returns the tasks array
   */
  runSync(): Task[];
  /**
   * Returns the tasks results as a table.
   * @param convert - an optional callback to convert the task result to a table record
   * @returns the tasks results as an array of table records
   */
  table(convert?: ConsoleTableConverter): (null | Record<string, number | string | undefined>)[];
}
//#endregion
//#region src/utils.d.ts
/**
 * Converts nanoseconds to milliseconds.
 * @param ns - the nanoseconds to convert
 * @returns the milliseconds
 */
declare const nToMs: (ns: TimestampValue) => number;
/**
 * Formats a number with the specified significant digits and maximum fraction digits.
 * @param value - the number to format
 * @param significantDigits - the number of significant digits in the output to aim for
 * @param maxFractionDigits - hard limit for the number of digits after the decimal dot
 * @returns the formatted number
 */
declare const formatNumber: (value: number, significantDigits?: number, maxFractionDigits?: number) => string;
/**
 * Returns the current timestamp in milliseconds using `performance.now()`.
 * @returns the current timestamp in milliseconds
 */
declare const performanceNow: () => DOMHighResTimeStamp;
/**
 * Returns the current timestamp in milliseconds using `process.hrtime.bigint()`.
 * @returns the current timestamp in milliseconds
 */
declare const hrtimeNow: () => number;
//#endregion
export { Bench, type BenchEvent, type BenchEvents, type BenchEventsWithTask, type BenchLike, type BenchOptions, type Concurrency, type ConsoleTableConverter, type EventListener, type EventListenerObject, type Fn, type FnHook, type FnOptions, type FnReturnedObject, type Hook, type JSRuntime, type NowFn, type ResolvedBenchOptions, type Samples, type SortedSamples, type Statistics, Task, type TaskEvents, type TaskResult, type TaskResultAborted, type TaskResultAbortedWithStatistics, type TaskResultCompleted, type TaskResultErrored, type TaskResultNotStarted, type TaskResultRuntimeInfo, type TaskResultStarted, type TaskResultTimestampProviderInfo, type TaskResultWithStatistics, type TimestampFn, type TimestampFns, type TimestampProvider, type TimestampValue, formatNumber, hrtimeNow, nToMs, performanceNow as now };