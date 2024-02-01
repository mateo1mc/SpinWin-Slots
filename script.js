let points = 1000;

function spin() {
  const symbols = [
      'seven7.jpg', 
      'orange.jpg', 
      'cherry.jpg', 
      'rrush.jpg', 
      'watermelon.jpg',
      'lucky.jpg',
      'lemon.jpg', 
  ];

  const spinCost = 50;

  // Check if there are enough points to spin
  if (points >= spinCost) {
    points -= spinCost;
    // Update points display
    document.getElementById('currentPoints').textContent = points;

    // Function to get a random symbol
    const getRandomSymbol = () => symbols[Math.floor(Math.random() * symbols.length)];

    // Update the slot elements with random symbols
    for (let i = 1; i <= 15; i++) {
        const slotImg = document.createElement('img');
        slotImg.src = getRandomSymbol();
        document.getElementById(`slot${i}`).innerHTML = '';
        document.getElementById(`slot${i}`).appendChild(slotImg);
    }

    // Apply a spin animation to the slots
    const slots = document.querySelectorAll('.slot');
    slots.forEach(slot => {
      slot.style.transform = 'rotateY(360deg)';
      setTimeout(() => {
        slot.style.transform = 'rotateY(0deg)';
      }, 500);
    });

    // Check for a win
    checkWin();
  }
}

function checkWin() {
    const winRows = [
    [6, 7, 8, 9, 10],
    [1, 2, 3, 4, 5],
    [11, 12, 13, 14, 15],
    [1, 7, 13, 9, 5],
    [11, 7, 3, 9, 15],
    [6, 2, 3, 4, 10],
    [6, 12, 13, 14, 10],
    [1, 2, 8, 14, 15],
    [11, 12, 8, 4, 5],
    [6, 12, 8, 4, 10],
    [6, 2, 8, 14, 10],
    [1, 7, 8, 9, 5],
    [11, 7, 8, 9, 15],
    [1, 7, 3, 9, 5],
    [11, 7, 13, 9, 15],
    [6, 7, 3, 9, 10],
    [6, 7, 13, 9, 10],
    [1, 2, 13, 4, 5],
    [11, 12, 3, 14, 15],
    [1, 12, 13, 14, 5],
    [11, 2, 3, 4, 15],
    [6, 12, 3, 14, 10],
    [6, 2, 13, 4, 10],
    [1, 12, 3, 14, 5],
    [11, 2, 13, 4, 15],
    ];

    const slots = document.querySelectorAll('.slot');
    const slotSymbols = Array.from(slots).map(slot => slot.querySelector('img').src);

    // Check if any of the winRows match the current slot symbols
    const isWin = winRows.some(row => {
      const symbolsInRow = row.map(slotIndex => slotSymbols[slotIndex - 1]); // Adjust for 0-indexing
      const allSame = symbolsInRow.every((symbol, index, array) => symbol === array[0]);
      return allSame;
    });

    // Update the result message
    const resultElement = document.getElementById('result');
    if (isWin) {
      resultElement.textContent = 'Congratulations! You win!';
      points +=100;
      document.getElementById('currentPoints').textContent = points;
  } else {
      resultElement.textContent = 'Better luck next time!';
  }

    // Check if the game should stop
    if (points <= 0) {
      alert('Game over! You ran out of points.\n Refres to Play Again');
    }

}
