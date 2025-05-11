function fetchUsers() {
    fetch('/users')
      .then(res => res.json())
      .then(data => {
        const output = document.getElementById('output');
        output.textContent = JSON.stringify(data, null, 2);
      });
  }
  
  function fetchLog() {
    fetch('/logs')
      .then(res => res.text())
      .then(data => {
        document.getElementById('output').textContent = data;
      });
  }
  