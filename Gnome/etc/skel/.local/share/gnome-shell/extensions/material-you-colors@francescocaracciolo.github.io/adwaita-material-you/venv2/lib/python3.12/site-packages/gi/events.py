# -*- Mode: Python; py-indent-offset: 4 -*-
# pygobject - Python bindings for the GObject library
# Copyright (C) 2021 Benjamin Berg <bberg@redhat.com
# Copyright (C) 2019 James Henstridge <james@jamesh.id.au>
#
#   gi/asyncio.py: GObject asyncio integration
#
# This library is free software; you can redistribute it and/or
# modify it under the terms of the GNU Lesser General Public
# License as published by the Free Software Foundation; either
# version 2.1 of the License, or (at your option) any later version.
#
# This library is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
# Lesser General Public License for more details.
#
# You should have received a copy of the GNU Lesser General Public
# License along with this library; if not, see <http://www.gnu.org/licenses/>.

__all__ = ['GLibEventLoopPolicy', 'GLibEventLoop']

import sys
import asyncio
from asyncio import coroutines
import signal
import threading
import selectors
import weakref
import warnings
from contextlib import contextmanager
from . import _ossighelper

from gi.repository import GLib

try:
    g_main_loop_run = super(GLib.MainLoop, GLib.MainLoop).run
except AttributeError:
    g_main_loop_run = GLib.MainLoop.run


class _GLibEventLoopMixin:
    """
    Base functionally required for both proactor and selector.

    The proactor/selector is always available through _selector, and we assume
    it has the following extra functionality that we provide:
     * _source: the GSource subclass
     * _dispatching: boolean whether it is dispatching currently
     * attach/detach: add/remove the GSource from the main context

    In principle, we simply override run_forever to call into GLib, with the
    assumption that a GSource is registered which will then call back into
    the python mainloop _run_once handler when needed. This in turn calls
    self._selector.select(), which means we just need to make sure to return
    our already prepared events at that point.
    """

    def __init__(self, main_context):
        # A mainloop in case we want to run our context
        assert main_context is not None
        self._context = main_context
        self._main_loop = GLib.MainLoop.new(self._context, False)
        self._quit_funcs = []

    @contextmanager
    def paused(self):
        """This context manager ensures the EventLoop is *not* being iterated.

        It purely exist to handle the case where python code iterates the main
        context more gracefully."""
        # Nothing to do if we are not running or dispatched by ourselves
        if not self.is_running() or self._selector._source._dispatching:
            yield
            return

        try:
            self._selector.detach()
            yield
        finally:
            self._selector.attach()

    @contextmanager
    def running(self, quit_func):
        """This context manager ensures the EventLoop is marked as running
        while other API is iterating its main context.
        The passed quit function is used to stop all recursion levels when
        stop() is called.
        """
        assert self._context.acquire()

        self._quit_funcs.append(quit_func)
        # Nested main context iteration (by using glib API)
        if self.is_running():
            try:
                yield
            finally:
                self._context.release()
                self._quit_funcs.pop()
                # Stop recursively
                if self._stopping:
                    self._quit_funcs[-1]()
            return

        # Outermost nesting
        self._check_closed()
        self._set_coroutine_origin_tracking(self._debug)
        self._thread_id = threading.get_ident()

        old_agen_hooks = sys.get_asyncgen_hooks()
        sys.set_asyncgen_hooks(firstiter=self._asyncgen_firstiter_hook,
                               finalizer=self._asyncgen_finalizer_hook)
        try:
            asyncio._set_running_loop(self)
            assert not self._selector._source._dispatching
            self._selector.attach()
            yield
        finally:
            self._selector.detach()
            self._context.release()
            self._thread_id = None
            asyncio._set_running_loop(None)
            try:
                self._set_coroutine_origin_tracking(False)
            except AttributeError:
                pass
            sys.set_asyncgen_hooks(*old_agen_hooks)

            self._quit_funcs.pop()
            assert len(self._quit_funcs) == 0
            self._stopping = False

    def time(self):
        return GLib.get_monotonic_time() / 1000000

    def _get_timeout_ms(self):
        if not self.is_running():
            warnings.warn('GLibEventLoop is iterated without being marked as running. Missing override or invalid use of existing API!', RuntimeWarning)
        if self._stopping is True:
            warnings.warn('GLibEventLoop is not stopping properly. Missing override or invalid use of existing API!', RuntimeWarning)
        if self._ready:
            return 0

        if self._scheduled:
            # The time is floor'ed here.
            # Python dispatches everything ready within the next _clock_resolution.
            timeout = int((self._scheduled[0]._when - self.time()) * 1000)
            return timeout if timeout >= 0 else 0

        return -1

    def stop(self):
        # Simply quit the mainloop
        self._stopping = True
        if self._quit_funcs:
            self._quit_funcs[-1]()

    def __repr__(self):
        return (
            f'<{self.__class__.__name__} running={self.is_running()} '
            f'closed={self.is_closed()} debug={self.get_debug()} '
            f'ctx=0x{hash(self._context):X} loop=0x{hash(self._main_loop):X}>'
        )


class _GLibEventLoopRunMixin:
    # This class exists so we don't need to copy the ProactorEventLoop.run_forever,
    # instead, we change the MRO using a metaclass, so that super() sees this class
    # when called in ProactorEventLoop.run_forever.

    def run_forever(self):
        # NOTE: self._check_running was only added in 3.8 (with a typo in 3.7)
        if self.is_running():
            raise RuntimeError('This event loop is already running')

        with _ossighelper.register_sigint_fallback(self._main_loop.quit):
            with self.running(self._main_loop.quit):
                g_main_loop_run(self._main_loop)


class _SourceBase(GLib.Source):
    """Common Source functionality for both unix and win32"""
    def __init__(self, selector):
        super().__init__()

        self._dispatching = False

        # It is *not* safe to run the *python* part of the mainloop recursively.
        # This error must be caught further up in the chain, otherwise the
        # mainloop will be blocking without an obvious reason.
        self.set_can_recurse(False)
        self.set_name('python asyncio integration')

        self._selector = selector
        # NOTE: Avoid loop -> selector -> source -> loop reference cycle,
        # we need the source to be destroyed *after* the selector. Otherwise
        # we need a flag to deal with FDs being unregistered after __del__ has
        # been called on the source.
        self._loop = weakref.ref(selector._loop)

        self._ready = []

    def dispatch(self, callback, args):
        # Now, wag the dog by its tail
        self._dispatching = True
        try:
            self._loop()._run_once()
        finally:
            self._dispatching = False

        return GLib.SOURCE_CONTINUE

    def _get_ready(self):
        if not self._dispatching:
            raise RuntimeError("gi.asyncio.Selector.select only works while it is dispatching!")

        ready = self._ready
        self._ready = []
        return ready


class _SelectorMixin:
    """A Mixin for common functionality of the Selector and Proactor."""

    def __init__(self, context, loop):
        super().__init__()

        self._context = context
        self._loop = loop
        self._fd_to_key = {}

        self._source = _Source(self)

    def close(self):
        if self._source:
            self._source.destroy()
            self._source = None
        super().close()

    def select(self, timeout=None):
        return self._source._get_ready()

    def _real_select(self, timeout=None):
        return super().select(timeout)


if sys.platform != 'win32':
    class GLibEventLoop(_GLibEventLoopMixin, _GLibEventLoopRunMixin, asyncio.SelectorEventLoop):
        """An asyncio event loop that runs the python mainloop inside GLib.

        Based on the asyncio.SelectorEventLoop"""

        _GLIB_SIGNALS = {signal.SIGHUP, signal.SIGINT, signal.SIGTERM, signal.SIGUSR1, signal.SIGUSR2, signal.SIGWINCH}

        # This is based on the selector event loop, but never actually runs select()
        # in the strict sense.
        # We use the selector to register all FDs with the main context using our
        # own GSource. For python timeouts/idle equivalent, we directly query them
        # from the context by providing the _get_timeout_ms function that the
        # GSource uses. This in turn accesses _ready and _scheduled to calculate
        # the timeout and whether python can dispatch anything non-FD based yet.
        #
        # The Selector select() method simply returns the information we already
        # collected.
        #
        # The rest is done by the mixin which overrides run_forever to simply
        # iterate the main context.
        def __init__(self, main_context):
            _GLibEventLoopMixin.__init__(self, main_context)

            # _UnixSelectorEventLoop uses _signal_handlers, we could do the same,
            # with the difference that close() would clean up the handlers for us.
            self.__signal_handlers = {}

            selector = _Selector(self._context, self)
            asyncio.SelectorEventLoop.__init__(self, selector)

            # Used by run_once to not busy loop if the timeout is floor'ed to zero
            self._clock_resolution = 1e-3

        def add_signal_handler(self, sig, callback, *args):
            """Add a handler for UNIX signal"""

            if (coroutines.iscoroutine(callback) or
                    coroutines.iscoroutinefunction(callback)):
                raise TypeError("coroutines cannot be used "
                                "with add_signal_handler()")
            self._check_closed()

            # Can be useful while testing failures
            # assert sig != signal.SIGALRM

            if sig not in self._GLIB_SIGNALS:
                return super().add_signal_handler(sig, callback, *args)

            # Pure python demands that there is only one signal handler
            source, _, _ = self.__signal_handlers.get(sig, (None, None, None))
            if source:
                source.destroy()

            # Setup a new source with a higher priority than our main one
            source = GLib.unix_signal_source_new(sig)
            source.set_name(f"asyncio signal watch for {sig}")
            source.set_priority(GLib.PRIORITY_HIGH)
            source.attach(self._context)
            source.set_callback(self._signal_cb, sig)

            self.__signal_handlers[sig] = (source, callback, args)
            del source

        def remove_signal_handler(self, sig):
            if sig not in self._GLIB_SIGNALS:
                return super().remove_signal_handler(sig)

            try:
                source, _, _ = self.__signal_handlers[sig]
                del self.__signal_handlers[sig]
                # Really unref the underlying GSource so that GLib resets the signal handler
                source.destroy()
                source._clear_boxed()

                # GLib does not restore the original signal handler.
                # Try to restore the python handler for SIGINT, this makes
                # Ctrl+C work after the mainloop has quit.
                if sig == signal.SIGINT and _ossighelper.PyOS_getsig(signal.SIGINT) == 0:
                    if _ossighelper.startup_sigint_ptr > 0:
                        _ossighelper.PyOS_setsig(signal.SIGINT, _ossighelper.startup_sigint_ptr)

                return True
            except KeyError:
                return False

        def _signal_cb(self, sig):
            source, cb, args = self.__signal_handlers.get(sig)

            # Pass over to python mainloop
            self.call_soon(cb, *args)

        def close(self):
            super().close()
            for s in list(self.__signal_handlers):
                self.remove_signal_handler(s)

    def _fileobj_to_fd(fileobj):
        # Note: SelectorEventloop should only be passing FDs
        if isinstance(fileobj, int):
            return fileobj
        else:
            return fileobj.fileno()

    class _Source(_SourceBase):
        def prepare(self):
            timeout = self._loop()._get_timeout_ms()

            # NOTE: Always return False, FDs are queried in check and the timeout
            #       needs to be rechecked anyway.
            return False, timeout

        def check(self):
            ready = []

            for key in self._selector._fd_to_key.values():
                condition = self.query_unix_fd(key._tag)
                events = 0
                # ERR/HUP/NVAL trigger both read/write (PRI cannot happen)
                if condition & ~GLib.IOCondition.OUT:
                    events |= selectors.EVENT_READ
                if condition & ~GLib.IOCondition.IN:
                    events |= selectors.EVENT_WRITE
                if events:
                    ready.append((key, events))
            self._ready = ready

            timeout = self._loop()._get_timeout_ms()
            if timeout == 0:
                return True

            return bool(ready)

    class _SelectorKey(selectors.SelectorKey):
        # Subclass to attach _tag
        pass

    class _Selector(_SelectorMixin, selectors.BaseSelector):
        """A Selector for gi.events.GLibEventLoop registering python IO with GLib."""

        def attach(self):
            self._source.attach(self._loop._context)

        def detach(self):
            self._source.destroy()
            self._source = _Source(self)
            # re-register the keys with the new source
            for key in self._fd_to_key.values():
                self._register_key(key)

        def _register_key(self, key):
            condition = GLib.IOCondition(0)
            if key.events & selectors.EVENT_READ:
                condition |= GLib.IOCondition.IN
            if key.events & selectors.EVENT_WRITE:
                condition |= GLib.IOCondition.OUT
            key._tag = self._source.add_unix_fd(key.fd, condition)

        def register(self, fileobj, events, data=None):
            if (not events) or (events & ~(selectors.EVENT_READ | selectors.EVENT_WRITE)):
                raise ValueError("Invalid events: {!r}".format(events))

            fd = _fileobj_to_fd(fileobj)
            assert fd not in self._fd_to_key

            key = _SelectorKey(fileobj, fd, events, data)

            self._register_key(key)

            self._fd_to_key[fd] = key
            return key

        def unregister(self, fileobj):
            # NOTE: may be called after __del__ has been called.
            fd = _fileobj_to_fd(fileobj)
            key = self._fd_to_key[fd]

            if self._source:
                self._source.remove_unix_fd(key._tag)
            del self._fd_to_key[fd]

            return key

        # We could override modify, but it is only slightly when the "events" change.

        def get_key(self, fileobj):
            fd = _fileobj_to_fd(fileobj)
            return self._fd_to_key[fd]

        def get_map(self):
            """Return a mapping of file objects to selector keys."""
            # Horribly inefficient
            # It should never be called and exists just to prevent issues if e.g.
            # python decides to use it for debug purposes.
            return {k.fileobj: k for k in self._fd_to_key.values()}


else:
    class _PushRunMixinBackMeta(type):
        # This metaclass changes the MRO so that when run_forever is called, it
        # first calls asyncio.ProactorEventLoop and then chains into
        # _GLibEventLoopRunMixin.run_forever using super().
        # The alternative would be to copy asyncio.ProactorEventLoop.run_forever
        def mro(cls):
            mro = type.mro(cls)
            idx = mro.index(_GLibEventLoopRunMixin)

            return [*mro[:idx], mro[idx + 1], mro[idx], *mro[idx + 2:]]

    class GLibEventLoop(_GLibEventLoopMixin, _GLibEventLoopRunMixin, asyncio.ProactorEventLoop, metaclass=_PushRunMixinBackMeta):
        """An asyncio event loop that runs the python mainloop inside GLib.

        Based on the asyncio.WindowsProactorEventLoopPolicy"""

        # This is based on the Windows ProactorEventLoop
        def __init__(self, main_context):
            _GLibEventLoopMixin.__init__(self, main_context)

            proactor = _Proactor(self._context, self)
            # Sets both self._proactor and self._selector to the proactor
            asyncio.ProactorEventLoop.__init__(self, proactor)

            # Used by run_once to not busy loop if the timeout is floor'ed to zero
            self._clock_resolution = 1e-3

    class _Source(_SourceBase):
        def __init__(self, proactor):
            self._proactor = proactor
            super().__init__(proactor)

            # None denotes it is disabled (and will also not handle timeouts)
            self._poll_fd = None

        def enable(self):
            assert self._poll_fd is None

            self._poll_fd = GLib.PollFD(self._proactor._iocp, GLib.IO_IN)
            self.add_poll(self._poll_fd)

        def disable(self):
            self.remove_poll(self._poll_fd)
            self._poll_fd = None

        def prepare(self):
            # Disabled, do not handle timeouts either
            if self._poll_fd is None:
                return False, -1

            timeout = self._loop()._get_timeout_ms()

            return bool(self._ready), timeout

        def check(self):
            if self._poll_fd is None:
                return False

            if self._poll_fd.revents:
                self._ready.extend(self._proactor._real_select(0))

            if self._ready:
                return True

            if self._loop()._get_timeout_ms() == 0:
                return True

            return False

    class _Proactor(_SelectorMixin, asyncio.IocpProactor):
        """A Proactor for gi.events.GLibEventLoop registering python IO with GLib."""

        def __init__(self, context, loop):
            super().__init__(context, loop)

            # We always use the same Source on windows, it disables itself
            self._source = _Source(self)
            self._source.attach(context)

        def attach(self):
            self._source.enable()

        def detach(self):
            self._source.disable()


class GLibEventLoopPolicy(asyncio.AbstractEventLoopPolicy):
    """An asyncio event loop policy that runs the GLib main loop.

    The policy allows creating a new EventLoop for threads other than the main
    thread. For the main thread, you can use get_event_loop() to retrieve the
    correct mainloop and run it.

    Note that, unlike GLib, python does not support running the EventLoop
    recursively. You should never iterate the GLib.MainContext from within
    the python EventLoop as doing so prevents asyncio events from being
    dispatched.

    As such, do not use API such as GLib.MainLoop.run or Gtk.Dialog.run.
    Instead use the proper asynchronous patterns to prevent entirely blocking
    asyncio.
    """

    def __init__(self):
        self._loops = {}
        self._child_watcher = None

    def get_event_loop(self):
        """Get the event loop for the current context.

        Returns an event loop object for the thread default GLib.MainContext
        or in case of the main thread for the default GLib.MainContext.

        An exception will be thrown if there is no GLib.MainContext for the
        current thread. In that case, using new_event_loop() will create a new
        main context and main loop which can subsequently attached to the thread
        by calling set_event_loop().

        Returns a new GLibEventLoop or raises an exception."""

        # Get the thread default main context
        ctx = GLib.MainContext.get_thread_default()
        # If there is none, and we are on the main thread, then use the default context
        if ctx is None and threading.current_thread() is threading.main_thread():
            ctx = GLib.MainContext.default()

        # We do not create a main context implicitly;
        # we create a mainloop for an existing context though
        if ctx is None:
            raise RuntimeError('There is no main context set for thread %r.'
                               % threading.current_thread().name)

        return self.get_event_loop_for_context(ctx)

    def get_event_loop_for_context(self, ctx):
        """Get the event loop for a specific context."""
        # Note: We cannot attach it to ctx, as getting the default will always
        #       return a new python wrapper. But, we can use hash() as that returns
        #       the pointer to the C structure.
        try:
            loop = self._loops[hash(ctx)]
            if not loop.is_closed():
                return loop
        except KeyError:
            pass

        self._loops[hash(ctx)] = GLibEventLoop(ctx)
        if self._child_watcher and ctx == GLib.MainContext.default():
            self._child_watcher.attach_loop(self.get_event_loop())
        return self._loops[hash(ctx)]

    def set_event_loop(self, loop):
        """Set the event loop for the current context (python thread) to loop.

        This is only permitted if the thread has no thread default main context
        with the main thread using the default main context.
        """

        # Only accept glib event loops, otherwise things will just mess up
        assert loop is None or isinstance(loop, GLibEventLoop)

        ctx = ctx_td = GLib.MainContext.get_thread_default()
        if ctx is None and threading.current_thread() is threading.main_thread():
            ctx = GLib.MainContext.default()

        if loop is None:
            # We do permit unsetting the current loop/context
            old = self._loops.pop(hash(ctx), None)
            if old:
                if hash(old._context) != hash(ctx):
                    warnings.warn('GMainContext was changed unknowingly by asyncio integration!', RuntimeWarning)
                if ctx_td:
                    GLib.MainContext.pop_thread_default(ctx_td)
        else:
            # Only allow attaching if the thread has no main context yet
            if ctx:
                raise RuntimeError('Thread %r already has a main context, get_event_loop() will create a new loop if needed'
                                   % threading.current_thread().name)

            GLib.MainContext.push_thread_default(loop._context)
            self._loops[hash(loop._context)] = loop

    def new_event_loop(self):
        """Create and return a new event loop that iterates a new
        GLib.MainContext."""

        return GLibEventLoop(GLib.MainContext())

    # NOTE: We do *not* provide a GLib based ChildWatcher implementation!
    # This is *intentional* and *required*. The issue is that python provides
    # API which uses wait4() internally. GLib at the same time uses a thread to
    # handle SIGCHLD signals, which causes a race condition resulting in a
    # critical warning.
    # We just provide a reasonable sane child watcher and disallow the user
    # from choosing one as e.g. MultiLoopChildWatcher is problematic.
    #
    # TODO: Use PidfdChildWatcher when available
    if sys.platform != 'win32':
        def get_child_watcher(self):
            if self._child_watcher is None:
                self._child_watcher = asyncio.ThreadedChildWatcher()

                if threading.current_thread() is threading.main_thread():
                    self._child_watcher.attach_loop(self.get_event_loop())

            return self._child_watcher
