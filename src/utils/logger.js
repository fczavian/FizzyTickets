import chalk from 'chalk';

function getTimestamp() {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

export const logger = {
  info(message, ...args) {
    console.log(
      chalk.gray(`[${getTimestamp()}]`),
      chalk.blue.bold('[INFO]'),
      message,
      ...args
    );
  },

  success(message, ...args) {
    console.log(
      chalk.gray(`[${getTimestamp()}]`),
      chalk.green.bold('[SUCCESS]'),
      message,
      ...args
    );
  },

  warn(message, ...args) {
    console.warn(
      chalk.gray(`[${getTimestamp()}]`),
      chalk.yellow.bold('[WARN]'),
      message,
      ...args
    );
  },

  error(message, error) {
    console.error(
      chalk.gray(`[${getTimestamp()}]`),
      chalk.red.bold('[ERROR]'),
      message
    );
    if (error) {
      if (error.stack) {
        console.error(chalk.red(error.stack));
      } else {
        console.error(chalk.red(error));
      }
    }
  },

  debug(message, ...args) {
    if (process.env.DEBUG === 'true') {
      console.log(
        chalk.gray(`[${getTimestamp()}]`),
        chalk.magenta.bold('[DEBUG]'),
        message,
        ...args
      );
    }
  }
};
