export const convertTime = (nanosecs) => {
	if (nanosecs === 0) {
		return '--';
	}

	const milisecs = Number(nanosecs / BigInt(10 ** 6));
	let dateObj = new Date(milisecs);
	let date = dateObj.toLocaleDateString('en-us', {
		weekday: 'short',
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});
	let time = dateObj.toLocaleString('en-us', {
		hour: 'numeric',
		minute: 'numeric',
		hour12: true,
	});
	return date + ', ' + time;
};

export const truncateAddress = (address) => {
	if (!address) return;
	return address.slice(0, 5) + '...' + address.slice(address.length - 5, address.length);
};
