// utils/getRandomMotivation.js
const motivations = require('../data/motivations');

function getRandomMotivation() {
  const index = Math.floor(Math.random() * motivations.length);
  return motivations[index];
}

module.exports = getRandomMotivation;