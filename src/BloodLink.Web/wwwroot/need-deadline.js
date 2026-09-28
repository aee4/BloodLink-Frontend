window.bloodLinkNeedDeadline = {
    defaultLocalValue: function () {
        const deadline = new Date(Date.now() + 60 * 60 * 1000);
        const pad = value => String(value).padStart(2, "0");
        return `${deadline.getFullYear()}-${pad(deadline.getMonth() + 1)}-${pad(deadline.getDate())}T${pad(deadline.getHours())}:${pad(deadline.getMinutes())}`;
    },
    toUtcIfFuture: function (elementId) {
        const value = document.getElementById(elementId)?.value;
        if (!value) return null;
        const localDate = new Date(value);
        if (Number.isNaN(localDate.getTime()) || localDate.getTime() <= Date.now()) return null;
        const [datePart, timePart] = value.split("T");
        const [year, month, day] = datePart.split("-").map(Number);
        const [hour, minute] = timePart.split(":").map(Number);
        if (localDate.getFullYear() !== year || localDate.getMonth() + 1 !== month || localDate.getDate() !== day
            || localDate.getHours() !== hour || localDate.getMinutes() !== minute) return null;
        return localDate.toISOString();
    }
};
