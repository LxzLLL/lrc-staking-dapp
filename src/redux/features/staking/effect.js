import { all, takeLatest } from 'redux-saga/effects';
import {
  STAKING_DO_STAKE,
  STAKING_GET_STAKE_LIST,
  STAKING_GET_TOTAL_STAKE,
  STAKING_GET_YOUR_STAKE,
  STAKING_DO_CLAIM,
  STAKING_DO_WITHDRAW
} from './action';
import {fetchContract, sendContract} from "../../../utils/simpleContractFetching";
import {put} from "@redux-saga/core/effects";
import {onError, onSuccess} from "../../../utils/createAsyncAction";

const fetchTotalStake = function* (action) {
  yield fetchContract(action, 'total', [], [{from: 0x0}]);
};

const makeBatchRequest = (library, calls) => {
  let batch = new library.BatchRequest();

  let promises = calls.map(call => {
    return new Promise((res, rej) => {
      let req = call.request({ from: 0x0}, (err, data) => {
        if(err) rej(err);
        else res(data);
      });
      batch.add(req);
    })
  });
  batch.execute();

  return Promise.all(promises);
};

const fetchEventStackedList = function* (action) {
  try {
    const eventList = yield action.data.contract.getPastEvents('LRCStaked', {fromBlock: 0, toBlock: 'latest'});
    const addressSet = Array.from(new Set(eventList.map(e => e.returnValues.user)));
    const stackedList = yield makeBatchRequest(action.data.library, addressSet.map(e =>  action.data.contract.methods.stakings(e).call));

    yield put({ data: stackedList, type: onSuccess(action.type) })
  } catch (error) {
    yield put({ data: error, type: onError(action.type)})
  }
};

const fetchYourStake = function* (action) {
  try {
    let stake = yield action.data.contract.methods.getUserStaking(action.data.address).call({from: 0x0});
    stake = {...stake, ...yield action.data.contract.methods.stakings(action.data.address).call({from: 0x0})};
    yield put({ data: stake, type: onSuccess(action.type) })
  } catch (error) {
    yield put({ data: error, type: onError(action.type)})
  }
};

const doStake = function* (action) {
  yield sendContract(action, 'stake', [action.data.amount],
    [{from: action.data.address}]);
  yield put({ data: action.data, type: STAKING_GET_YOUR_STAKE });
};

const doClaim = function* (action) {
  yield sendContract(action, 'claim', [],
    [{from: action.data.address}]);
  yield put({ data: action.data, type: STAKING_GET_YOUR_STAKE });
};

const doWithdraw = function* (action) {
  yield sendContract(action, 'withdraw', [action.data.amount],
    [{from: action.data.address}]);
  yield put({ data: action.data, type: STAKING_GET_YOUR_STAKE });
};

export default function* () {
  yield all([
    takeLatest(STAKING_GET_STAKE_LIST, fetchEventStackedList),
    takeLatest(STAKING_GET_TOTAL_STAKE, fetchTotalStake),
    takeLatest(STAKING_GET_YOUR_STAKE, fetchYourStake),
    takeLatest(STAKING_DO_STAKE, doStake),
    takeLatest(STAKING_DO_CLAIM, doClaim),
    takeLatest(STAKING_DO_WITHDRAW, doWithdraw),
  ]);
}
