package ulid

import (
	"io"
	"math/rand"
	"sync"
	"time"

	"github.com/oklog/ulid"
)

var pool = sync.Pool{
	New: func() interface{} {
		return ulid.Monotonic(rand.New(rand.NewSource(time.Now().UTC().UnixNano())), 0)
	},
}

func New(t time.Time) (ulid.ULID, error) {
	if t.IsZero() {
		t = time.Now().UTC()
	}
	entropy := pool.Get().(io.Reader)
	u, err := ulid.New(ulid.Timestamp(t), entropy)
	pool.Put(entropy)
	return u, err
}
