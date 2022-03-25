// Code generated by MockGen. DO NOT EDIT.
// Source: github.com/jamillosantos/logviewer/internal/transport/http/websocket (interfaces: EntriesSearcher,WebsSocketConn)

// Package websocket is a generated GoMock package.
package websocket

import (
	context "context"
	reflect "reflect"

	gomock "github.com/golang/mock/gomock"
	entryreader "github.com/jamillosantos/lovr/internal/service/entryreader"
)

// MockEntriesSearcher is a mock of EntriesSearcher interface.
type MockEntriesSearcher struct {
	ctrl     *gomock.Controller
	recorder *MockEntriesSearcherMockRecorder
}

// MockEntriesSearcherMockRecorder is the mock recorder for MockEntriesSearcher.
type MockEntriesSearcherMockRecorder struct {
	mock *MockEntriesSearcher
}

// NewMockEntriesSearcher creates a new mock instance.
func NewMockEntriesSearcher(ctrl *gomock.Controller) *MockEntriesSearcher {
	mock := &MockEntriesSearcher{ctrl: ctrl}
	mock.recorder = &MockEntriesSearcherMockRecorder{mock}
	return mock
}

// EXPECT returns an object that allows the caller to indicate expected use.
func (m *MockEntriesSearcher) EXPECT() *MockEntriesSearcherMockRecorder {
	return m.recorder
}

// Search mocks base method.
func (m *MockEntriesSearcher) Search(arg0 context.Context, arg1 entryreader.SearchRequest) (entryreader.SearchResponse, error) {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "Search", arg0, arg1)
	ret0, _ := ret[0].(entryreader.SearchResponse)
	ret1, _ := ret[1].(error)
	return ret0, ret1
}

// Search indicates an expected call of Search.
func (mr *MockEntriesSearcherMockRecorder) Search(arg0, arg1 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Search", reflect.TypeOf((*MockEntriesSearcher)(nil).Search), arg0, arg1)
}

// MockWebsSocketConn is a mock of WebsSocketConn interface.
type MockWebsSocketConn struct {
	ctrl     *gomock.Controller
	recorder *MockWebsSocketConnMockRecorder
}

// MockWebsSocketConnMockRecorder is the mock recorder for MockWebsSocketConn.
type MockWebsSocketConnMockRecorder struct {
	mock *MockWebsSocketConn
}

// NewMockWebsSocketConn creates a new mock instance.
func NewMockWebsSocketConn(ctrl *gomock.Controller) *MockWebsSocketConn {
	mock := &MockWebsSocketConn{ctrl: ctrl}
	mock.recorder = &MockWebsSocketConnMockRecorder{mock}
	return mock
}

// EXPECT returns an object that allows the caller to indicate expected use.
func (m *MockWebsSocketConn) EXPECT() *MockWebsSocketConnMockRecorder {
	return m.recorder
}

// Close mocks base method.
func (m *MockWebsSocketConn) Close() error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "Close")
	ret0, _ := ret[0].(error)
	return ret0
}

// Close indicates an expected call of Close.
func (mr *MockWebsSocketConnMockRecorder) Close() *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "Close", reflect.TypeOf((*MockWebsSocketConn)(nil).Close))
}

// ReadJSON mocks base method.
func (m *MockWebsSocketConn) ReadJSON(arg0 interface{}) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "ReadJSON", arg0)
	ret0, _ := ret[0].(error)
	return ret0
}

// ReadJSON indicates an expected call of ReadJSON.
func (mr *MockWebsSocketConnMockRecorder) ReadJSON(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "ReadJSON", reflect.TypeOf((*MockWebsSocketConn)(nil).ReadJSON), arg0)
}

// WriteJSON mocks base method.
func (m *MockWebsSocketConn) WriteJSON(arg0 interface{}) error {
	m.ctrl.T.Helper()
	ret := m.ctrl.Call(m, "WriteJSON", arg0)
	ret0, _ := ret[0].(error)
	return ret0
}

// WriteJSON indicates an expected call of WriteJSON.
func (mr *MockWebsSocketConnMockRecorder) WriteJSON(arg0 interface{}) *gomock.Call {
	mr.mock.ctrl.T.Helper()
	return mr.mock.ctrl.RecordCallWithMethodType(mr.mock, "WriteJSON", reflect.TypeOf((*MockWebsSocketConn)(nil).WriteJSON), arg0)
}
