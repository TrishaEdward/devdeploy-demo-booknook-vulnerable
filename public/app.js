// Frontend for BookNook. Uses jQuery to talk to the API.
// The flaws are deliberate: API data is injected as raw HTML.  [NOT FLAGGED]

var selectedBook = { id: 1, title: 'Dune' };

// A stable colour per title, so each book gets its own "cover".
function hue(text) {
  var h = 0;
  String(text).split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) % 360; });
  return h;
}

function renderBooks(books) {
  if (!books.length) {
    $('#results').html('<p class="empty">No books match your search.</p>');
    return;
  }
  // Client-side (DOM) XSS: title/author go in as raw HTML.      [NOT FLAGGED]
  $('#results').html(books.map(function (b) {
    return '<article class="book" data-id="' + b.id + '">' +
      '<div class="cover" style="--h:' + hue(b.title) + '"><span>' + b.title + '</span></div>' +
      '<div class="meta"><h3>' + b.title + '</h3><p>' + b.author + '</p>' +
      '<div class="price">$' + Number(b.price).toFixed(2) + '</div></div></article>';
  }).join(''));
  $('.book[data-id="' + selectedBook.id + '"]').addClass('selected');
}

function search(q) {
  $.getJSON('/api/books/search', { q: q }, renderBooks);
}

function loadReviews() {
  $.getJSON('/api/reviews', { book_id: selectedBook.id }, function (rows) {
    if (!rows.length) {
      $('#reviews').html('<p class="empty">No reviews yet. Be the first!</p>');
      return;
    }
    // Stored XSS: a review's name and text are rendered as HTML.  [NOT FLAGGED]
    $('#reviews').html(rows.map(function (r) {
      return '<div class="review"><div class="avatar">' + String(r.author).charAt(0).toUpperCase() + '</div>' +
        '<div><div class="who">' + r.author + '</div><div class="text">' + r.body + '</div></div></div>';
    }).join(''));
  });
}

function selectBook(id, title) {
  selectedBook = { id: id, title: title };
  $('.book').removeClass('selected');
  $('.book[data-id="' + id + '"]').addClass('selected');
  $('#reviewBookTitle').text(title ? '· ' + title : '');
  loadReviews();
}

$('#results').on('click', '.book', function () {
  var card = $(this);
  selectBook(card.data('id'), card.find('h3').text());
});

$('#searchForm').on('submit', function (e) {
  e.preventDefault();
  search($('#q').val());
});

// ---- sign in
$('#openLogin').on('click', function () { document.getElementById('loginDialog').showModal(); });
$('#closeLogin').on('click', function () { document.getElementById('loginDialog').close(); });

$('#loginForm').on('submit', function (e) {
  e.preventDefault();
  $.ajax({
    url: '/api/login',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({ name: $('#name').val(), password: $('#password').val() }),
    success: function (r) {
      // Stored in localStorage where any XSS can steal it.      [NOT FLAGGED]
      localStorage.setItem('token', r.token);
      $('#userChip').html('👤 <b>' + r.user.name + '</b> · ' + r.user.role).prop('hidden', false);
      $('#openLogin').hide();
      document.getElementById('loginDialog').close();
    },
    error: function () { $('#loginMsg').addClass('err').text('Wrong username or password.'); }
  });
});

// ---- reviews
$('#reviewBtn').on('click', function () {
  $.ajax({
    url: '/api/reviews',
    method: 'POST',
    contentType: 'application/json',
    data: JSON.stringify({ book_id: selectedBook.id, author: $('#author').val() || 'Anonymous', body: $('#body').val() }),
    success: function () { $('#body').val(''); loadReviews(); }
  });
});

search('');
loadReviews();
