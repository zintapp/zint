import { Subject, Subscriber, Subscription } from 'rxjs';

export class ReplayOnceSubject<T> extends Subject<T> {
   _buffer: T[][] = [ [] ];
   _wasSubscribed = false;

  next(value: T) {
    const { isStopped, _buffer, _wasSubscribed } = this;
    if (!isStopped && !_wasSubscribed) {
      _buffer[0].push(value);
    }
    super.next(value);
  }

  /** @internal */
  _subscribe(subscriber: Subscriber<T>): Subscription {
      //@ts-ignore
    this._throwIfClosed();

    //@ts-ignore
    const subscription = this._innerSubscribe(subscriber);

    if(!this._wasSubscribed) {
      this._wasSubscribed = true
      const _buffer = this._buffer.pop();

      for (let i = 0; i < _buffer!.length && !subscriber.closed; i += 1) {
        subscriber.next(_buffer![i]);
      }
    }

    //@ts-ignore
    this._checkFinalizedStatuses(subscriber);

    return subscription;
  }

}
