/**
 * Utility functions for quarter validation and confirmation
 */

/**
 * Gets the current quarter information
 * @returns {Object} { year, quarter }
 */
export const getCurrentQuarter = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const quarter = Math.floor(month / 3) + 1;
  return { year, quarter };
};

/**
 * Gets the quarter range for a specific year and quarter
 * @param {number} year 
 * @param {number} quarter 
 * @returns {Object} { from, to }
 */
export const getQuarterRange = (year, quarter) => {
  const q = Number(quarter);
  const y = Number(year);
  const startMonth = (q - 1) * 3; // 0,3,6,9
  const from = new Date(y, startMonth, 1);
  const to = new Date(y, startMonth + 3, 0); // last day of quarter
  return { from, to };
};

/**
 * Checks if a date is outside the current quarter
 * @param {string|Date} date - The date to check
 * @returns {Object} { isOutsideQuarter, currentQuarter, dateQuarter, message }
 */
export const checkQuarterValidation = (date) => {
  const currentQuarter = getCurrentQuarter();
  const currentQuarterRange = getQuarterRange(currentQuarter.year, currentQuarter.quarter);
  
  const dateToCheck = new Date(date);
  const isOutsideQuarter = dateToCheck < currentQuarterRange.from || dateToCheck > currentQuarterRange.to;
  
  // Determine which quarter the date belongs to
  const dateYear = dateToCheck.getFullYear();
  const dateMonth = dateToCheck.getMonth();
  const dateQuarter = Math.floor(dateMonth / 3) + 1;
  
  let message = '';
  if (isOutsideQuarter) {
    if (dateToCheck < currentQuarterRange.from) {
      message = `La fecha ${dateToCheck.toLocaleDateString('es-ES')} pertenece al trimestre anterior (T${dateQuarter} ${dateYear})`;
    } else {
      message = `La fecha ${dateToCheck.toLocaleDateString('es-ES')} pertenece al trimestre siguiente (T${dateQuarter} ${dateYear})`;
    }
    message += `. ¿Desea continuar con esta operación fuera del trimestre actual (T${currentQuarter.quarter} ${currentQuarter.year})?`;
  }
  
  return {
    isOutsideQuarter,
    currentQuarter,
    dateQuarter: { year: dateYear, quarter: dateQuarter },
    message,
    currentQuarterRange
  };
};

/**
 * Shows a confirmation dialog for operations outside the current quarter
 * @param {string} message - The confirmation message
 * @returns {Promise<boolean>} - True if user confirms, false if cancels
 */
export const confirmOutsideQuarterOperation = (message) => {
  return new Promise((resolve) => {
    const confirmed = window.confirm(message);
    resolve(confirmed);
  });
};
